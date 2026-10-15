/**
 * 飲食營養測試。
 * 測試食物重量換算、每日資料隔離、飲食紀錄保存，以及攝影機結果對應營養資料。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { nutrition, playerSummary } from "../js/services/nutrition.service.js";
import { request } from "../js/api/api.js";
import { seed, today } from "../js/api/seed.js";
import { signIn } from "../js/api/session.js";
import { completeMealAnalysis, mealView, previewCatalog, startMealAnalysis } from "../js/services/meal.service.js";
import {
  attachMealImage,
  confirmMealItem,
  openDraftMeal,
  queueMealAnalysis,
  readMeal,
  submitMeal,
  addRecord,
} from "../js/api/meal.api.js";
import { loadPage } from "../js/services/workspace.service.js";
test("nutrition scales food nutrient rows by actual grams", () => {
  assert.equal(seed.foods[0].calories, undefined);
  const n = nutrition([{ foodId: "f1", grams: 200 }], seed.foodNutrients);
  assert.equal(n.calories, 330);
  assert.equal(n.protein, 62);
  assert.equal(n.fat, 7.2);
});
test("summary isolates player and date and counts distinct meals", () => {
  const p = seed.players[0];
  const record = {
    playerId: p.id,
    date: today,
    meal: "午餐",
    status: "submitted",
    nutrition: { calories: 165, protein: 31, carbs: 0, fat: 4 },
  };
  const s = playerSummary(p, [
    record,
    record,
    { ...record, date: "2025-01-01" },
    { ...record, playerId: "p2" },
    { ...record, status: "draft", nutrition: { calories: 999, protein: 0, carbs: 0, fat: 0 } },
  ], today);
  assert.equal(s.totals.calories, 330);
  assert.equal(s.completion, 33);
});
test("record save updates player summary through service", async () => {
  await signIn("acct-p1");
  const before = (await loadPage()).players.find((player) => player.id === "p1");
  await addRecord({
    playerId: "p1",
    date: today,
    meal: "晚餐",
    items: [{ foodId: "f1", grams: 100 }],
  });
  const after = (await loadPage()).players.find((player) => player.id === "p1");
  assert.equal(after.totals.calories, before.totals.calories + 165);
  assert.equal(after.completion, 100);
});
test("invalid quantities cannot become official records", async () => {
  await assert.rejects(() =>
    addRecord({ items: [{ foodId: "f1", grams: 0 }] }),
  );
  await assert.rejects(() => addRecord({ items: [] }));
});

test("camera analysis moves queued to running to succeeded and intake uses snapshots", async () => {
  await signIn("acct-p1");
  const meal = await openDraftMeal({
    athleteId: "p1",
    localDate: today,
    mealType: "lunch",
  });
  const image = await attachMealImage(meal.mealId);
  assert.equal(image.mealId, meal.mealId);
  assert.equal(image.revision, meal.revision + 1);
  let detail = await mealView(meal.mealId);
  assert.ok(detail.image.objectKey);
  assert.notEqual(detail.image.objectKey, meal.mealId);
  const queued = await queueMealAnalysis(meal.mealId);
  assert.equal(queued.revision, image.revision + 1);
  detail = await mealView(meal.mealId);
  assert.equal(detail.analysis.status, "queued");
  await assert.rejects(() => completeMealAnalysis(detail.analysis.id));
  const running = await startMealAnalysis(detail.analysis.id);
  assert.equal(running.status, "running");
  const done = await completeMealAnalysis(detail.analysis.id);
  assert.equal(done.status, "succeeded");
  let view = await readMeal(meal.mealId);
  assert.equal(view.items.length, 3);
  assert.ok(view.items.every((item) => item.confirmationStatus === "pending"));
  assert.equal(view.nutrition.calories, 0);
  assert.equal(view.image.objectKey, detail.image.objectKey);
  for (const item of view.items) await confirmMealItem(meal.mealId, item.id);
  view = await readMeal(meal.mealId);
  const preview = await previewCatalog(
    view.items.map((item) => ({ foodId: item.foodId, grams: item.confirmedWeightG })),
  );
  assert.deepEqual(view.nutrition, preview);
  const snapshotCalories = view.nutritionExact.calories;
  await request("/foodNutrients/fn-f1-energy", {
    method: "PATCH",
    body: { amountPer100g: 999 },
  });
  view = await readMeal(meal.mealId);
  assert.equal(view.nutritionExact.calories, snapshotCalories);
  const itemCount = view.items.length;
  await submitMeal(meal.mealId, "lunch");
  const loaded = (await loadPage()).records.find((item) => item.id === meal.mealId);
  assert.equal(loaded.status, "submitted");
  assert.equal(loaded.items.length, itemCount);
  assert.equal(loaded.analysis.status, "succeeded");
  assert.deepEqual(loaded.nutrition, preview);
});
test("unmapped camera food and missing weight block preview and save", async () => {
  for (const items of [
    [{ foodId: "unknown", grams: 100 }],
    [{ foodId: "f1" }],
    [{ foodId: "f1", grams: 3001 }],
  ]) {
    await assert.rejects(() => previewCatalog(items));
    await assert.rejects(() => addRecord({ items }));
  }
});
