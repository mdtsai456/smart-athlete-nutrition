/**
 * 餐點命令。
 * 建立草稿、修改、第一次送出。畫面不逐表新增或刪除。
 * 操作者只來自登入 session。教練不能修改餐點。
 */
import { config, request } from "./api.js";
import { assertMockWrite, csrfHeader } from "./session.js";
import {
  addMealItem as writeMealItem,
  attachMealImage as writeMealImage,
  confirmMealItem as writeConfirm,
  editMeal,
  deleteMealItem as writeDeleteItem,
  deleteMealImage,
  mealIdOf,
  mealView as engineMealView,
  openDraftMeal as createDraft,
  queueMealAnalysis as writeQueue,
  rejectMealItem as writeReject,
  reopenMeal as writeReopen,
  reviewMeal as writeReview,
  submitMeal as writeSubmit,
  completeMealAnalysis,
  startMealAnalysis,
  ANALYSIS_STATUS,
  previewCatalog,
} from "../services/meal.service.js";

const ACTIONS = new Set([
  "edit",
  "add_item",
  "confirm",
  "reject",
  "delete_item",
  "add_image",
  "delete_image",
  "queue_analysis",
  "review",
  "reopen",
]);

/** 營養師是 nutritionist。球員是 player 加自己的編號。 */
async function actorFromSession(session) {
  if (session.role === "nutritionist") return "nutritionist";
  if (session.role === "athlete") return `player:${session.athleteId}`;
  throw new Error("教練不能修改餐點");
}

async function guard() {
  if (config.mode !== "mock") return null;
  return assertMockWrite();
}

/** 建立草稿。版本從 1 開始。 */
export async function createMeal(body) {
  if (config.mode !== "mock")
    return request("/meals", { method: "POST", body, headers: csrfHeader() });
  const session = await guard();
  return createDraft({
    athleteId: body.athleteId,
    localDate: body.localDate,
    mealType: body.mealType,
    actorId: await actorFromSession(session),
  });
}

/**
 * 送出前的修改，以及送出後的修正。
 * 必須帶目前版本。動作見 ACTIONS。
 */
export async function mutateMeal(mealId, body) {
  if (!ACTIONS.has(body.action)) throw new Error("不支援的餐點操作");
  if (config.mode !== "mock")
    return request(`/meals/${mealId}/mutations`, {
      method: "POST",
      body,
      headers: csrfHeader(),
    });
  const session = await guard();
  const actor = await actorFromSession(session);
  const payload = body.payload || {};
  const reason = body.reason;
  switch (body.action) {
    case "edit":
      return editMeal(mealId, actor, payload, body.expectedRevision);
    case "add_item":
      return writeMealItem(mealId, actor, payload, body.expectedRevision);
    case "confirm":
      return writeConfirm(
        payload.itemId,
        actor,
        { ...payload, reason: reason ?? payload.reason },
        body.expectedRevision,
      );
    case "reject":
      return writeReject(payload.itemId, actor, reason, body.expectedRevision);
    case "delete_item":
      return writeDeleteItem(payload.itemId, actor, body.expectedRevision, reason);
    case "add_image":
      return writeMealImage(mealId, actor, body.expectedRevision);
    case "delete_image":
      return deleteMealImage(mealId, actor, body.expectedRevision);
    case "queue_analysis":
      return writeQueue(mealId, actor, body.expectedRevision);
    case "review":
      return writeReview(mealId, actor, body.expectedRevision);
    case "reopen":
      return writeReopen(mealId, actor, reason, body.expectedRevision);
    default: {
      const unknown = body.action;
      throw new Error(unknown ? "不支援的餐點操作" : "缺少餐點操作");
    }
  }
}

/** 第一次送出。送出後再改走 mutateMeal，不再走這裡。 */
export async function saveMeal(mealId, body) {
  if (config.mode !== "mock")
    return request(`/meals/${mealId}/submit`, {
      method: "POST",
      body,
      headers: csrfHeader(),
    });
  const session = await guard();
  return writeSubmit(mealId, await actorFromSession(session), body.mealType, {
    expectedRevision: body.expectedRevision,
    requestId: body.requestId,
  });
}

/** 排隊中改為分析中。分析中且沒有指定結果時，用佔位辨識完成。 */
export async function readMeal(mealId) {
  if (config.mode !== "mock") return request(`/meals/${mealId}`);
  let view = await engineMealView(mealId);
  if (view.analysis?.status === "queued") {
    const running = await startMealAnalysis(view.analysis.id);
    view = {
      ...view,
      analysis: { ...view.analysis, ...running, statusLabel: ANALYSIS_STATUS.running },
    };
  } else if (view.analysis?.status === "running") {
    await completeMealAnalysis(view.analysis.id);
    view = await engineMealView(mealId);
  }
  return view;
}
/** 使用傳入的辨識結果。不改走佔位辨識。 */
export async function finishMealAnalysis(mealId, outcome) {
  const view = await engineMealView(mealId);
  if (view.analysis?.status !== "running") throw new Error("分析還沒開始，或已經結束");
  await completeMealAnalysis(view.analysis.id, outcome);
  return engineMealView(mealId);
}

/** 下面是固定動作的簡寫，仍走建立、修改或送出。 */
export const openDraftMeal = (input) => createMeal(input);
export const attachMealImage = (mealId, expectedRevision) =>
  mutateMeal(mealId, { action: "add_image", expectedRevision, payload: {} });
export const queueMealAnalysis = (mealId, expectedRevision) =>
  mutateMeal(mealId, { action: "queue_analysis", expectedRevision, payload: {} });
export const addMealItem = (mealId, item, expectedRevision) =>
  mutateMeal(mealId, { action: "add_item", expectedRevision, payload: item });
export const submitMeal = (mealId, mealType, meta = {}) =>
  saveMeal(mealId, { mealType, ...meta });
export const reopenMeal = (mealId, reason, expectedRevision) =>
  mutateMeal(mealId, { action: "reopen", expectedRevision, payload: {}, reason });
export const reviewMeal = (mealId, expectedRevision) =>
  mutateMeal(mealId, { action: "review", expectedRevision, payload: {} });

/** 先由項目找到餐點，再走修改。確認、拒絕、刪除都一樣。 */
export async function confirmMealItem(itemId, patch = {}, expectedRevision) {
  return mutateMeal(await mealIdOf(itemId), {
    action: "confirm",
    expectedRevision,
    payload: { itemId, ...patch },
  });
}
export async function rejectMealItem(itemId, reason, expectedRevision) {
  return mutateMeal(await mealIdOf(itemId), {
    action: "reject",
    expectedRevision,
    payload: { itemId },
    reason,
  });
}
export async function deleteMealItem(itemId, expectedRevision, reason) {
  return mutateMeal(await mealIdOf(itemId), {
    action: "delete_item",
    expectedRevision,
    payload: { itemId },
    reason,
  });
}
/** 依序建立餐點、確認每個項目，然後送出。 */
export async function addRecord(data) {
  const mealType =
    {
      早餐: "breakfast",
      午餐: "lunch",
      晚餐: "dinner",
      點心: "snack",
    }[data.meal] || data.mealType;
  await previewCatalog(data.items);
  const meal = await createMeal({
    athleteId: data.playerId,
    localDate: data.date,
    mealType,
  });
  let revision = meal.revision;
  for (const item of data.items) {
    const added = await mutateMeal(meal.mealId, {
      action: "add_item",
      expectedRevision: revision,
      payload: { foodId: item.foodId, grams: item.grams },
    });
    const confirmed = await mutateMeal(meal.mealId, {
      action: "confirm",
      expectedRevision: added.revision,
      payload: {
        itemId: added.itemId,
        foodId: item.foodId,
        weightG: item.grams,
        weightSource: "manual",
      },
    });
    revision = confirmed.revision;
  }
  await saveMeal(meal.mealId, {
    mealType,
    requestId: crypto.randomUUID(),
    expectedRevision: revision,
  });
  return readMeal(meal.mealId);
}
/** 刪掉草稿裡的每一項。每刪一項，版本加 1。 */
export async function clearDraftItems(mealId) {
  let view = await engineMealView(mealId);
  for (const item of view.items) {
    const removed = await mutateMeal(mealId, {
      action: "delete_item",
      expectedRevision: view.revision,
      payload: { itemId: item.id },
    });
    view = { ...view, revision: removed.revision };
  }
  return { mealId: String(mealId), revision: view.revision };
}
