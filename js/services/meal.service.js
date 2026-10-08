/**
 * 餐點、影像與分析。
 * 送出不重建項目。
 * 送出固定已確認項目的營養資料，狀態改為已送出，並寫入 MealRevision。
 */
import { collection } from "../api/api.js";
import { foods, foodNutrients } from "../api/food.api.js";
import {
  nutrition,
  nutritionFromSnapshots,
  roundedNutrition,
} from "./nutrition.service.js";
const mealRecords = collection("mealRecords");
const mealItems = collection("mealItems");
const mealItemNutrients = collection("mealItemNutrients");
const mealImages = collection("mealImages");
const mealAnalyses = collection("mealAnalyses");
const mealRevisions = collection("mealRevisions");
const tables = {
  foods,
  foodNutrients,
  mealAnalyses,
  mealImages,
  mealItemNutrients,
  mealItems,
  mealRecords,
};
export const MEAL_TYPES = Object.freeze([
  ["breakfast", "早餐"],
  ["lunch", "午餐"],
  ["dinner", "晚餐"],
  ["snack", "點心"],
  ["pre_training", "訓練前"],
  ["post_training", "訓練後"],
]);
const MEAL_LABEL = Object.fromEntries(MEAL_TYPES);
const MEAL_STATUS = { draft: "草稿", submitted: "已送出", reviewed: "已審核" };
export const MAX_ITEM_GRAMS = 3000;
export const ANALYSIS_STATUS = {
  queued: "排隊中",
  running: "分析中",
  succeeded: "分析完成",
  failed: "分析失敗",
};
const ITEM_STATUS = { pending: "待確認", confirmed: "已確認", rejected: "已拒絕" };
const nowIso = () => new Date().toISOString();
function consumedNow(localDate) {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return new Date(
    `${localDate}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}+08:00`,
  ).toISOString();
}
async function rowsOf(name) {
  return tables[name].list();
}
async function requireMeal(mealId) {
  const meal = await mealRecords.get(mealId);
  if (!meal) throw new Error("找不到餐點");
  return meal;
}
function assertCanEdit(meal, actorId) {
  if (meal.status === "reviewed") throw new Error("已審核的餐點不能修改");
  if (meal.status === "submitted" && actorId !== "nutritionist")
    throw new Error("已送出的餐點只有營養師可以修正");
  if (meal.status !== "draft" && meal.status !== "submitted")
    throw new Error("餐點狀態不允許修改");
}
function assertRevision(meal, expectedRevision) {
  if (expectedRevision == null || expectedRevision === "") return;
  if (Number(expectedRevision) !== Number(meal.revision ?? 1)) {
    const error = new Error("Meal has been modified");
    error.status = 409;
    error.code = "REVISION_CONFLICT";
    error.currentRevision = Number(meal.revision ?? 1);
    throw error;
  }
}
function commandResult(meal) {
  return { mealId: String(meal.id), revision: Number(meal.revision ?? 1) };
}
async function advanceMeal(mealId, patch = {}) {
  const meal = await requireMeal(mealId);
  const updated = await mealRecords.update(mealId, {
    ...patch,
    revision: Number(meal.revision ?? 1) + 1,
    updatedAt: nowIso(),
  });
  return commandResult(updated);
}
export async function openDraftMeal({ athleteId, localDate, mealType, actorId }) {
  if (!MEAL_LABEL[mealType]) throw new Error("請選擇餐別");
  const stamp = nowIso();
  const meal = await mealRecords.create({
      athleteId,
      consumedAt: new Date(`${localDate}T12:00:00+08:00`).toISOString(),
      localDate,
      timezone: "Asia/Taipei",
      mealType,
      note: null,
      status: "draft",
      revision: 1,
      createdByAccountId: actorId,
      statusChangedByAccountId: null,
      statusChangedAt: null,
      statusChangeReason: null,
      createdAt: stamp,
      updatedAt: stamp,
  });
  return commandResult(meal);
}
export async function editMeal(mealId, actorId, payload, expectedRevision) {
  const meal = await requireMeal(mealId);
  assertCanEdit(meal, actorId);
  assertRevision(meal, expectedRevision);
  if (payload.mealType && !MEAL_LABEL[payload.mealType]) throw new Error("請選擇餐別");
  return advanceMeal(mealId, {
    mealType: payload.mealType || meal.mealType,
    note: payload.note ?? meal.note,
    consumedAt: payload.consumedAt || meal.consumedAt,
    timezone: payload.timezone || meal.timezone,
  });
}
export async function attachMealImage(mealId, actorId, expectedRevision) {
  const meal = await requireMeal(mealId);
  assertCanEdit(meal, actorId);
  assertRevision(meal, expectedRevision);
  await mealImages.create({
      mealRecordId: mealId,
      objectKey: `meals/${mealId}/${crypto.randomUUID()}.jpg`,
      mimeType: "image/jpeg",
      uploadedAt: nowIso(),
      uploadedByAccountId: actorId,
  });
  return advanceMeal(mealId);
}
export async function deleteMealImage(mealId, actorId, expectedRevision) {
  const meal = await requireMeal(mealId);
  assertCanEdit(meal, actorId);
  assertRevision(meal, expectedRevision);
  const image = (await rowsOf("mealImages")).findLast((row) => row.mealRecordId === mealId);
  if (!image) throw new Error("找不到影像");
  await mealImages.remove(image.id);
  return advanceMeal(mealId);
}
export async function queueMealAnalysis(mealId, actorId, expectedRevision) {
  const meal = await requireMeal(mealId);
  assertCanEdit(meal, actorId);
  assertRevision(meal, expectedRevision);
  await mealAnalyses.create({
      mealRecordId: mealId,
      modelName: "食物攝影機（模擬）",
      modelVersion: "mock-1",
      status: "queued",
      rawResultJson: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: nowIso(),
      queuedByAccountId: actorId,
  });
  return advanceMeal(mealId);
}
export async function startMealAnalysis(analysisId) {
  const analysis = await mealAnalyses.get(analysisId);
  if (!analysis) throw new Error("找不到分析");
  if (analysis.status !== "queued") throw new Error("只有排隊中的分析可以開始");
  return mealAnalyses.update(analysisId, { status: "running", startedAt: nowIso() });
}
/** 模擬食物辨識。最多回傳三道有營養資料的菜色。重量範圍為 80–300 g，間隔為 10 g。 */
function demoRecognitionItems(foods, foodNutrientRows) {
  const withNutrients = new Set(foodNutrientRows.map((row) => row.foodId));
  const pool = foods.filter(
    (food) => food.status !== "inactive" && withNutrients.has(food.id),
  );
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = pool[index];
    pool[index] = pool[swap];
    pool[swap] = current;
  }
  return pool.slice(0, 3).map((food) => ({
    foodId: food.id,
    grams: (8 + Math.floor(Math.random() * 23)) * 10,
    confidence: 80 + Math.floor(Math.random() * 19),
  }));
}
/** 缺少影像位址時，回傳失敗。此流程不傳送圖片，也不呼叫模型。 */
async function recognizeMealImage(objectKey) {
  if (!objectKey) return { succeeded: false, errorMessage: "尚未上傳餐盤影像" };
  const [foodRows, nutrientRows] = await Promise.all([
    rowsOf("foods"),
    rowsOf("foodNutrients"),
  ]);
  return {
    succeeded: true,
    foods: foodRows,
    items: demoRecognitionItems(foodRows, nutrientRows),
  };
}
function recognitionWeight(grams) {
  const weight = Number(grams);
  if (!Number.isFinite(weight) || weight <= 0 || weight > MAX_ITEM_GRAMS) return null;
  return weight;
}
function writeRecognitionItem(analysis, item, foods, stamp) {
  const food = item.foodId ? foods.find((row) => row.id === item.foodId) : null;
  return mealItems.create({
    mealRecordId: analysis.mealRecordId,
    mealAnalysisId: analysis.id,
    foodId: food?.id || null,
    detectedLabel: food?.name || item.detectedLabel || "尚未對應",
    estimatedWeightG: recognitionWeight(item.grams),
    confirmedWeightG: null,
    weightSource: null,
    confirmationStatus: "pending",
    snapshotNutrientCount: 0,
    confirmedByAccountId: null,
    confirmedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  });
}
/**
 * 未傳入結果時，使用模擬辨識。已傳入結果時，使用該結果，包括空陣列。
 * 無法對應菜色的項目保持待確認狀態。單一項目寫入失敗時，保留其他項目。
 */
export async function completeMealAnalysis(analysisId, outcome) {
  const analysis = await mealAnalyses.get(analysisId);
  if (!analysis) throw new Error("找不到分析");
  if (analysis.status !== "running") throw new Error("分析還沒開始，或已經結束");
  const stamp = nowIso();
  let resolved = outcome;
  if (outcome === undefined) {
    const image = (await rowsOf("mealImages")).findLast(
      (row) => row.mealRecordId === analysis.mealRecordId,
    );
    resolved = await recognizeMealImage(image?.objectKey);
  }
  if (!resolved.succeeded) {
    if (!resolved.errorMessage) throw new Error("失敗的分析需要錯誤說明");
    return mealAnalyses.update(analysisId, {
        status: "failed",
        errorMessage: resolved.errorMessage,
        rawResultJson: null,
        completedAt: stamp,
    });
  }
  const items = Array.isArray(resolved.items) ? resolved.items : [];
  const foods = resolved.foods || (items.length ? await rowsOf("foods") : []);
  await mealAnalyses.update(analysisId, {
      status: "succeeded",
      rawResultJson: { items },
      errorMessage: null,
      completedAt: stamp,
  });
  const failed = [];
  for (const item of items) {
    try {
      await writeRecognitionItem(analysis, item, foods, stamp);
    } catch (error) {
      failed.push({
        label: item.detectedLabel || item.foodId || "項目",
        reason: error.message,
      });
    }
  }
  const notice = [
    items.length ? "" : "這張照片沒有辨識到菜色",
    failed.length ? failed.map((row) => `${row.label}：${row.reason}`).join("；") : "",
  ]
    .filter(Boolean)
    .join("。");
  return mealAnalyses.update(analysisId, {
    rawResultJson: { items, notice, failed },
    errorMessage: null,
  });
}
async function clearSnapshots(itemId) {
  const snapshots = await rowsOf("mealItemNutrients");
  for (const row of snapshots.filter((row) => row.mealItemId === itemId))
    await mealItemNutrients.remove(row.id);
}
export async function deleteMealItem(itemId, actorId, expectedRevision, reason) {
  const item = await mealItems.get(itemId);
  if (!item) throw new Error("找不到餐點項目");
  const meal = await requireMeal(item.mealRecordId);
  assertCanEdit(meal, actorId);
  assertRevision(meal, expectedRevision);
  if (meal.status === "submitted" && !String(reason || "").trim())
    throw new Error("已送出後的刪除需要原因");
  await clearSnapshots(itemId);
  await mealItems.remove(itemId);
  return advanceMeal(meal.id);
}
export async function addMealItem(mealId, actorId, item, expectedRevision) {
  const meal = await requireMeal(mealId);
  assertCanEdit(meal, actorId);
  assertRevision(meal, expectedRevision);
  const stamp = nowIso();
  const created = await mealItems.create({
    mealRecordId: mealId,
    mealAnalysisId: item.analysisId || null,
    foodId: item.foodId || null,
    detectedLabel: item.detectedLabel || null,
    estimatedWeightG: item.grams ?? item.estimatedWeightG ?? null,
    confirmedWeightG: null,
    weightSource: null,
    confirmationStatus: "pending",
    snapshotNutrientCount: 0,
    confirmedByAccountId: null,
    confirmedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  });
  return { ...(await advanceMeal(mealId)), itemId: created.id };
}
/** 依目前食物表寫入營養資料。食物與重量均未變更時，不更新版本。 */
export async function confirmMealItem(itemId, actorId, patch = {}, expectedRevision) {
  const item = await mealItems.get(itemId);
  if (!item) throw new Error("找不到餐點項目");
  const meal = await requireMeal(item.mealRecordId);
  assertCanEdit(meal, actorId);
  assertRevision(meal, expectedRevision);
  const foodId = patch.foodId || item.foodId;
  const weight = patch.weightG ?? item.estimatedWeightG;
  const weightSource = patch.weightSource || (item.mealAnalysisId ? "ai" : "manual");
  if (!foodId) throw new Error("請先對應食物資料後再確認");
  if (!Number.isFinite(weight) || weight <= 0 || weight > MAX_ITEM_GRAMS)
    throw new Error("缺少有效食物重量，請重新拍攝或請營養師確認。");
  if (!["ai", "measured", "manual"].includes(weightSource))
    throw new Error("重量來源不正確");
  const same =
    item.confirmationStatus === "confirmed" &&
    item.foodId === foodId &&
    item.confirmedWeightG === weight &&
    item.weightSource === weightSource;
  if (same) return commandResult(meal);
  if (meal.status === "submitted" && !String(patch.reason || "").trim())
    throw new Error("已送出後的修正需要原因");
  const foodNutrients = (await rowsOf("foodNutrients")).filter(
    (row) => row.foodId === foodId,
  );
  if (!foodNutrients.length) throw new Error("這個食物還沒有營養素，不能確認");
  await clearSnapshots(itemId);
  const stamp = nowIso();
  for (const row of foodNutrients) {
    await mealItemNutrients.create({
        mealItemId: itemId,
        nutrientId: row.nutrientId,
        amount: Math.round(((row.amountPer100g * weight) / 100) * 10000) / 10000,
        calculatedAt: stamp,
    });
  }
  await mealItems.update(itemId, {
      foodId,
      confirmedWeightG: weight,
      weightSource,
      confirmationStatus: "confirmed",
      snapshotNutrientCount: foodNutrients.length,
      confirmedByAccountId: actorId,
      confirmedAt: stamp,
      updatedAt: stamp,
  });
  return advanceMeal(meal.id);
}
/** 保留該項目，將狀態設為已拒絕，並清除營養資料。 */
export async function rejectMealItem(itemId, actorId, reason, expectedRevision) {
  const item = await mealItems.get(itemId);
  if (!item) throw new Error("找不到餐點項目");
  const meal = await requireMeal(item.mealRecordId);
  assertCanEdit(meal, actorId);
  assertRevision(meal, expectedRevision);
  if (meal.status === "submitted" && !String(reason || "").trim())
    throw new Error("已送出後的拒絕需要原因");
  await clearSnapshots(itemId);
  await mealItems.update(itemId, {
      confirmedWeightG: null,
      weightSource: null,
      confirmationStatus: "rejected",
      snapshotNutrientCount: 0,
      confirmedByAccountId: null,
      confirmedAt: null,
      updatedAt: nowIso(),
      rejectedByAccountId: actorId,
  });
  return advanceMeal(meal.id);
}
/** 只有草稿可以送出。送出前，所有項目必須完成確認或拒絕，且分析必須結束。 */
function canSubmitMeal(meal, items, analyses) {
  if (!meal || meal.status !== "draft" || !items.length) return false;
  if (items.some((item) => item.confirmationStatus === "pending")) return false;
  return !analyses.some(
    (analysis) =>
      analysis.mealRecordId === meal.id &&
      (analysis.status === "queued" || analysis.status === "running"),
  );
}
/** 送出識別碼與內容均相同時，回傳第一次的結果。識別碼相同但內容不同時，拒絕請求。 */
export async function submitMeal(mealId, actorId, mealType, meta = {}) {
  const meal = await requireMeal(mealId);
  const items = (await rowsOf("mealItems")).filter(
    (item) => item.mealRecordId === mealId,
  );
  const requestId = meta.requestId || crypto.randomUUID();
  const payloadHash = JSON.stringify({
    mealType: mealType || meal.mealType,
    items: items.map((item) => [
      item.id,
      item.confirmationStatus,
      item.foodId,
      item.confirmedWeightG,
    ]),
  });
  if (meal.submitRequest?.id === requestId) {
    if (meal.submitRequest.hash !== payloadHash)
      throw new Error("同一送出識別碼不能改內容");
    return commandResult(meal);
  }
  if (meal.status !== "draft") throw new Error("只有草稿可以送出");
  assertRevision(meal, meta.expectedRevision);
  const analyses = (await rowsOf("mealAnalyses")).filter(
    (analysis) => analysis.mealRecordId === mealId,
  );
  if (mealType && !MEAL_LABEL[mealType]) throw new Error("請選擇餐別");
  if (!canSubmitMeal(meal, items, analyses))
    throw new Error("請先確認或拒絕每一項，並等分析結束後再送出。");
  for (const item of items.filter((item) => item.confirmationStatus === "confirmed")) {
    if (!item.snapshotNutrientCount) throw new Error("已確認項目缺少營養資料");
  }
  const stamp = nowIso();
  const nutrients = await rowsOf("mealItemNutrients");
  const nextRevision = Number(meal.revision ?? 1) + 1;
  await mealRevisions.create({
    mealRecordId: mealId,
    revision: nextRevision,
    command: "submit",
    requestId,
    items: items
      .filter((item) => item.confirmationStatus === "confirmed")
      .map((item) => ({
        itemId: item.id,
        foodId: item.foodId,
        confirmedWeightG: item.confirmedWeightG,
        nutrients: nutrients
          .filter((row) => row.mealItemId === item.id)
          .map((row) => ({ nutrientId: row.nutrientId, amount: row.amount })),
      })),
    createdAt: stamp,
  });
  return advanceMeal(mealId, {
      mealType: mealType || meal.mealType,
      consumedAt: consumedNow(meal.localDate),
      status: "submitted",
      submitRequest: { id: requestId, hash: payloadHash },
      statusChangedByAccountId: actorId,
      statusChangedAt: stamp,
      statusChangeReason: null,
  });
}
export async function reopenMeal(mealId, actorId, reason, expectedRevision) {
  if (actorId !== "nutritionist") throw new Error("只有營養師可以重新開啟");
  const note = String(reason || "").trim();
  if (!note) throw new Error("請填寫重新開啟的原因");
  const meal = await requireMeal(mealId);
  if (meal.status !== "reviewed") throw new Error("只有已審核的餐點可以重新開啟");
  assertRevision(meal, expectedRevision);
  const stamp = nowIso();
  return advanceMeal(mealId, {
      status: "submitted",
      statusChangedByAccountId: actorId,
      statusChangedAt: stamp,
      statusChangeReason: note,
  });
}
export async function reviewMeal(mealId, actorId, expectedRevision) {
  if (actorId !== "nutritionist") throw new Error("只有營養師可以審核");
  const meal = await requireMeal(mealId);
  if (meal.status !== "submitted") throw new Error("請先送出餐點再審核");
  assertRevision(meal, expectedRevision);
  const stamp = nowIso();
  return advanceMeal(mealId, {
      status: "reviewed",
      statusChangedByAccountId: actorId,
      statusChangedAt: stamp,
  });
}
/** 攝取量只加總已確認項目的營養資料。分析資料使用最新一筆紀錄。 */
export function presentMeal(meal, tables) {
  const items = tables.mealItems.filter((item) => item.mealRecordId === meal.id);
  const analyses = tables.mealAnalyses
    .filter((analysis) => analysis.mealRecordId === meal.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const analysis = analyses[0] || null;
  const image = tables.mealImages.findLast((row) => row.mealRecordId === meal.id) || null;
  const confirmed = items.filter((item) => item.confirmationStatus === "confirmed");
  const nutritionExact = nutritionFromSnapshots(
    confirmed.map((item) => item.id),
    tables.mealItemNutrients,
  );
  const shifted = new Date(new Date(meal.consumedAt).getTime() + 8 * 60 * 60 * 1000);
  const time = `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}`;
  return {
    id: meal.id,
    playerId: meal.athleteId,
    date: meal.localDate,
    time,
    meal: MEAL_LABEL[meal.mealType] || meal.mealType,
    mealType: meal.mealType,
    at: meal.consumedAt,
    createdAt: meal.createdAt,
    revision: meal.revision ?? 1,
    reason: meal.statusChangeReason,
    status: meal.status,
    statusLabel: MEAL_STATUS[meal.status] || meal.status,
    image: image && { ...image, url: image.url || null },
    analysis: analysis && {
      ...analysis,
      statusLabel: ANALYSIS_STATUS[analysis.status] || analysis.status,
      notice: analysis.status === "succeeded" ? analysis.rawResultJson?.notice || "" : "",
    },
    items: items.map((item) => ({
      ...item,
      name:
        tables.foods.find((food) => food.id === item.foodId)?.name ||
        item.detectedLabel ||
        "尚未對應",
      grams: item.confirmedWeightG ?? item.estimatedWeightG,
      confirmationLabel: ITEM_STATUS[item.confirmationStatus],
    })),
    nutritionExact,
    nutrition: roundedNutrition(nutritionExact),
    foodNames: confirmed
      .map(
        (item) =>
          tables.foods.find((food) => food.id === item.foodId)?.name ||
          item.detectedLabel,
      )
      .filter(Boolean)
      .join("、"),
    canSubmit: canSubmitMeal(meal, items, analyses),
  };
}
export async function mealView(mealId) {
  const meal = await requireMeal(mealId);
  const [foods, mealItems, mealItemNutrients, mealAnalyses, mealImages] =
    await Promise.all(
      ["foods", "mealItems", "mealItemNutrients", "mealAnalyses", "mealImages"].map(
        rowsOf,
      ),
    );
  return presentMeal(meal, {
    foods,
    mealItems,
    mealItemNutrients,
    mealAnalyses,
    mealImages,
  });
}
/** 送出前檢查每項都有菜色與有效重量。 */
export async function previewCatalog(items) {
  const [foods, foodNutrients] = await Promise.all([
    rowsOf("foods"),
    rowsOf("foodNutrients"),
  ]);
  if (
    !Array.isArray(items) ||
    !items.length ||
    items.some(
      (item) =>
        !Number.isFinite(item.grams) || item.grams <= 0 || item.grams > MAX_ITEM_GRAMS,
    )
  )
    throw new Error("缺少有效食物重量，請重新拍攝或請營養師確認。");
  if (items.some((item) => !foods.some((food) => food.id === item.foodId)))
    throw new Error("辨識食物尚未對應營養資料表，請營養師建檔後再記錄。");
  return roundedNutrition(nutrition(items, foodNutrients));
}
