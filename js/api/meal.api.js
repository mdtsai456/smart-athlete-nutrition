/**
 * 餐點命令。
 * 建立草稿、修改、第一次送出。頁面不對各資料表分別新增或刪除。
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
  mealView as engineMealView,
  openDraftMeal as createDraft,
  queueMealAnalysis as writeQueue,
  rejectMealItem as writeReject,
  reopenMeal as writeReopen,
  reviewMeal as writeReview,
  submitMeal as writeSubmit,
  completeMealAnalysis,
  startMealAnalysis,
  previewCatalog,
  MEAL_TYPES,
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

/** 營養師的操作者是 nutritionist。球員的操作者是 player 與球員編號。 */
function actorFromSession(session) {
  if (session.role === "nutritionist") return "nutritionist";
  if (session.role === "athlete") return `player:${session.athleteId}`;
  throw new Error("教練不能修改餐點");
}

// Mock 限制球員只能修改自己的餐點。正式 API 在後端做相同檢查。
function assertOwnMeal(session, athleteId) {
  if (session.role === "athlete" && session.athleteId !== athleteId)
    throw new Error("只能修改自己的餐點");
}

/** 建立草稿。版本從 1 開始。 */
export async function createMeal(body) {
  if (config.mode !== "mock")
    return request("/meals", { method: "POST", body, headers: csrfHeader() });
  const session = await assertMockWrite();
  assertOwnMeal(session, body.athleteId);
  return createDraft({
    athleteId: body.athleteId,
    localDate: body.localDate,
    mealType: body.mealType,
    actorId: actorFromSession(session),
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
  const session = await assertMockWrite();
  const actor = actorFromSession(session);
  const current = await engineMealView(mealId);
  assertOwnMeal(session, current.playerId);
  const payload = body.payload || {};
  if (["confirm", "reject", "delete_item"].includes(body.action)) {
    const item = current.items.find(item => item.id === payload.itemId);
    if (!item) throw new Error("餐點不包含此項目");
  }
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

  }
}

/** 第一次送出。送出後的修改呼叫 mutateMeal。 */
export async function saveMeal(mealId, body) {
  if (config.mode !== "mock")
    return request(`/meals/${mealId}/submit`, {
      method: "POST",
      body,
      headers: csrfHeader(),
    });
  const session = await assertMockWrite();
  assertOwnMeal(session, (await engineMealView(mealId)).playerId);
  return writeSubmit(mealId, actorFromSession(session), body.mealType, {
    expectedRevision: body.expectedRevision,
    requestId: body.requestId,
  });
}

/** 只讀取餐點，不修改分析狀態或建立項目。 */
export async function readMeal(mealId) {
  if (config.mode !== "mock") return request(`/meals/${mealId}`);
  return engineMealView(mealId);
}
/** 執行一次模擬分析。正式模式不呼叫本機模擬。 */
export async function finishMealAnalysis(mealId, outcome) {
  if (config.mode !== "mock") throw new Error("正式模式不支援模擬辨識");
  const session = await assertMockWrite();
  actorFromSession(session);
  const view = await engineMealView(mealId);
  assertOwnMeal(session, view.playerId);
  if (view.analysis?.status !== "queued") throw new Error("分析尚未排隊，或已經開始");
  await startMealAnalysis(view.analysis.id);
  await completeMealAnalysis(view.analysis.id, outcome);
  return engineMealView(mealId);
}

/** 這些函式呼叫 createMeal、mutateMeal 或 saveMeal。 */
export { createMeal as openDraftMeal };
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

/** 使用呼叫端提供的餐點 ID 與項目 ID。不查詢項目資料表。 */
export async function confirmMealItem(mealId, itemId, patch = {}, expectedRevision) {
  return mutateMeal(mealId, {
    action: "confirm",
    expectedRevision,
    payload: { itemId, ...patch },
  });
}
export async function rejectMealItem(mealId, itemId, reason, expectedRevision) {
  return mutateMeal(mealId, {
    action: "reject",
    expectedRevision,
    payload: { itemId },
    reason,
  });
}
export async function deleteMealItem(mealId, itemId, expectedRevision, reason) {
  return mutateMeal(mealId, {
    action: "delete_item",
    expectedRevision,
    payload: { itemId },
    reason,
  });
}
/** 依序建立餐點、確認每個項目，然後送出。 */
export async function addRecord(data) {
  const mealType = MEAL_TYPES.find(([, label]) => label === data.meal)?.[0] || data.mealType;
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
  let view = await readMeal(mealId);
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
