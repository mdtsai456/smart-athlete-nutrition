/**
 * 餐點狀態與營養資料測試。
 * 分析狀態只能向前。
 * 拒絕會清除營養資料。
 * 已審核餐點不可再改。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { signIn } from "../js/api/session.js";
import { completeMealAnalysis, mealView, startMealAnalysis } from "../js/services/meal.service.js";
import {
  confirmMealItem,
  deleteMealItem,
  attachMealImage,
  openDraftMeal,
  queueMealAnalysis,
  readMeal,
  rejectMealItem,
  reopenMeal,
  reviewMeal,
  submitMeal,
} from "../js/api/meal.api.js";
import { collection } from "../js/api/api.js";
import { today } from "../js/api/seed.js";
test("failed analysis does not create items and reviewed meals stay locked", async () => {
  await signIn("acct-p1");
  const meal = await openDraftMeal({
    athleteId: "p1",
    localDate: today,
    mealType: "dinner",
  });
  const queued = await queueMealAnalysis(meal.mealId);
  assert.equal(queued.revision, 2);
  let view = await mealView(meal.mealId);
  await startMealAnalysis(view.analysis.id);
  const failed = await completeMealAnalysis(view.analysis.id, {
    succeeded: false,
    errorMessage: "模型沒有回應",
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.rawResultJson, null);
  const empty = await readMeal(meal.mealId);
  assert.equal(empty.items.length, 0);
  await assert.rejects(() => submitMeal(meal.mealId));
  const retry = await queueMealAnalysis(meal.mealId);
  view = await mealView(meal.mealId);
  await startMealAnalysis(view.analysis.id);
  await attachMealImage(meal.mealId);
  await completeMealAnalysis(view.analysis.id);
  view = await readMeal(meal.mealId);
  await rejectMealItem(view.items[0].id);
  await confirmMealItem(view.items[1].id);
  await confirmMealItem(view.items[2].id);
  const rejected = (await readMeal(meal.mealId)).items[0];
  assert.equal(rejected.confirmationStatus, "rejected");
  assert.equal(rejected.snapshotNutrientCount, 0);
  await submitMeal(meal.mealId, "dinner");
  await assert.rejects(() => reviewMeal(meal.mealId));
  await signIn("acct-n1");
  await reviewMeal(meal.mealId);
  const reviewed = await readMeal(meal.mealId);
  assert.equal(reviewed.status, "reviewed");
  await assert.rejects(() => confirmMealItem(reviewed.items[1].id));
});
test("nutritionist reopens a reviewed meal with a reason", async () => {
  await signIn("acct-p2");
  const meal = await openDraftMeal({
    athleteId: "p2",
    localDate: today,
    mealType: "dinner",
  });
  const queued = await queueMealAnalysis(meal.mealId);
  assert.equal(queued.mealId, meal.mealId);
  let view = await mealView(meal.mealId);
  await startMealAnalysis(view.analysis.id);
  await attachMealImage(meal.mealId);
  await completeMealAnalysis(view.analysis.id);
  view = await mealView(meal.mealId);
  await assert.rejects(
    () => confirmMealItem(view.items[0].id, {}, 1),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "REVISION_CONFLICT");
      assert.equal(error.message, "Meal has been modified");
      assert.equal(error.currentRevision, view.revision);
      return true;
    },
  );
  for (const item of view.items) await confirmMealItem(item.id);
  const draft = await mealView(meal.mealId);
  const requestId = crypto.randomUUID();
  const submitted = await submitMeal(meal.mealId, "dinner", {
    requestId,
    expectedRevision: draft.revision,
  });
  const saved = await mealView(meal.mealId);
  assert.equal(saved.items.length, draft.items.length);
  assert.equal(submitted.revision, draft.revision + 1);
  assert.equal(saved.status, "submitted");
  const replay = await submitMeal(meal.mealId, "dinner", { requestId });
  assert.equal(replay.revision, submitted.revision);
  const revisions = (await collection("mealRevisions").list()).filter(
    (row) => row.mealRecordId === meal.mealId,
  );
  assert.equal(revisions.length, 1);
  assert.equal(revisions[0].revision, submitted.revision);
  assert.equal(revisions[0].command, "submit");
  await signIn("acct-n1");
  await reviewMeal(meal.mealId);
  await assert.rejects(() => reopenMeal(meal.mealId, "  "));
  const opened = await reopenMeal(meal.mealId, "晚餐份量偏多，請重拍");
  view = await readMeal(meal.mealId);
  assert.equal(opened.mealId, meal.mealId);
  assert.equal(opened.revision, view.revision);
  assert.equal(view.status, "submitted");
  assert.equal(view.reason, "晚餐份量偏多，請重拍");
  const target = view.items[0];
  await assert.rejects(() =>
    confirmMealItem(
      target.id,
      { weightG: 220, weightSource: "manual" },
      view.revision,
    ),
  );
  const corrected = await confirmMealItem(
    target.id,
    { weightG: 220, weightSource: "manual", reason: "實際份量是 220 克" },
    view.revision,
  );
  view = await readMeal(meal.mealId);
  assert.equal(corrected.revision, view.revision);
  assert.equal(view.items.find((item) => item.id === target.id).grams, 220);
  assert.equal(view.status, "submitted");
  const reviewedAgain = await reviewMeal(meal.mealId, view.revision);
  view = await readMeal(meal.mealId);
  assert.equal(reviewedAgain.revision, view.revision);
  assert.equal(view.status, "reviewed");
  await signIn("acct-n1");
  const openedAgain = await reopenMeal(meal.mealId, "再改一次份量", view.revision);
  view = await readMeal(meal.mealId);
  assert.equal(openedAgain.revision, view.revision);
  await assert.rejects(() =>
    deleteMealItem(target.id, view.revision, "  "),
  );
  await deleteMealItem(target.id, view.revision, "這項辨識錯了");
  view = await readMeal(meal.mealId);
  assert.equal(view.items.some((item) => item.id === target.id), false);
  assert.equal(view.status, "submitted");
  await signIn("acct-p2");
  await assert.rejects(() => submitMeal(meal.mealId, "dinner"));
  await assert.rejects(() => confirmMealItem(view.items[0].id));
});
test("missing recognition result draws catalog foods and an explicit result stays", async () => {
  await signIn("acct-p1");
  const foods = await collection("foods").list();
  const known = new Set(foods.map((food) => food.id));
  const meal = await openDraftMeal({
    athleteId: "p1",
    localDate: today,
    mealType: "snack",
  });
  await queueMealAnalysis(meal.mealId);
  let view = await mealView(meal.mealId);
  await startMealAnalysis(view.analysis.id);
  await attachMealImage(meal.mealId);
  await completeMealAnalysis(view.analysis.id);
  view = await mealView(meal.mealId);
  assert.equal(view.items.length, 3);
  assert.equal(new Set(view.items.map((item) => item.foodId)).size, 3);
  assert.ok(
    view.items.every(
      (item) => known.has(item.foodId) && item.grams >= 80 && item.grams <= 300,
    ),
  );
  const explicit = await openDraftMeal({
    athleteId: "p1",
    localDate: today,
    mealType: "snack",
  });
  await queueMealAnalysis(explicit.mealId);
  view = await mealView(explicit.mealId);
  await startMealAnalysis(view.analysis.id);
  await completeMealAnalysis(view.analysis.id, {
    succeeded: true,
    items: [{ foodId: "f6", grams: 90, confidence: 70 }],
  });
  view = await mealView(explicit.mealId);
  assert.deepEqual(
    view.items.map((item) => [item.foodId, item.grams]),
    [["f6", 90]],
  );
});
test("an empty recognition stays empty and an unknown food stays unmatched", async () => {
  await signIn("acct-p1");
  const meal = await openDraftMeal({
    athleteId: "p1",
    localDate: today,
    mealType: "snack",
  });
  await queueMealAnalysis(meal.mealId);
  let view = await mealView(meal.mealId);
  await startMealAnalysis(view.analysis.id);
  const empty = await completeMealAnalysis(view.analysis.id, { succeeded: true, items: [] });
  assert.equal(empty.status, "succeeded");
  assert.equal(empty.rawResultJson.notice, "這張照片沒有辨識到菜色");
  view = await mealView(meal.mealId);
  assert.equal(view.items.length, 0);
  assert.equal(view.analysis.notice, "這張照片沒有辨識到菜色");
  const mixed = await openDraftMeal({
    athleteId: "p1",
    localDate: today,
    mealType: "snack",
  });
  await queueMealAnalysis(mixed.mealId);
  view = await mealView(mixed.mealId);
  await startMealAnalysis(view.analysis.id);
  const done = await completeMealAnalysis(view.analysis.id, {
    succeeded: true,
    items: [
      { foodId: "f1", grams: 100, confidence: 90 },
      { detectedLabel: "沒看過的菜", grams: 80, confidence: 40 },
    ],
  });
  assert.equal(done.status, "succeeded");
  view = await mealView(mixed.mealId);
  assert.equal(view.items.length, 2);
  assert.equal(view.items[0].foodId, "f1");
  assert.equal(view.items[1].foodId, null);
  assert.equal(view.items[1].name, "沒看過的菜");
  await assert.rejects(() => confirmMealItem(view.items[1].id), /請先對應食物資料後再確認/);
});
test("recognition without an image fails and writes nothing", async () => {
  await signIn("acct-p1");
  const meal = await openDraftMeal({
    athleteId: "p1",
    localDate: today,
    mealType: "snack",
  });
  await queueMealAnalysis(meal.mealId);
  const view = await mealView(meal.mealId);
  await startMealAnalysis(view.analysis.id);
  const failed = await completeMealAnalysis(view.analysis.id);
  assert.equal(failed.status, "failed");
  assert.equal(failed.errorMessage, "尚未上傳餐盤影像");
  assert.equal((await mealView(meal.mealId)).items.length, 0);
});
