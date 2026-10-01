/**
 * 飲食營養回歸測試
 * 驗證食物重量換算、每日資料隔離、飲食紀錄保存，以及攝影機結果對應營養資料表的流程。透過 npm test 執行。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { nutrition, playerSummary } from "../js/services/nutrition.js";
import { seed, today } from "../js/api/seed.js";
import { platform } from "../js/services/platform.js";
test("nutrition scales food nutrients by actual grams", () => {
  const n = nutrition([{ foodId: "f1", grams: 200 }], seed.foods);
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
    items: [{ foodId: "f1", grams: 100 }],
  };
  const s = playerSummary(
    p,
    [
      record,
      record,
      { ...record, date: "2025-01-01" },
      { ...record, playerId: "p2" },
    ],
    seed.foods,
    today,
  );
  assert.equal(s.totals.calories, 330);
  assert.equal(s.completion, 33);
});
test("record save updates player summary through service", async () => {
  const before = await platform.load();
  await platform.addRecord({
    playerId: "p1",
    date: today,
    meal: "晚餐",
    items: [{ foodId: "f1", grams: 100 }],
  });
  const after = await platform.load();
  assert.equal(
    after.players[0].totals.calories,
    before.players[0].totals.calories + 165,
  );
  assert.equal(after.players[0].completion, 100);
});
test("invalid quantities cannot become official records", async () => {
  await assert.rejects(() =>
    platform.addRecord({ items: [{ foodId: "f1", grams: 0 }] }),
  );
  await assert.rejects(() => platform.addRecord({ items: [] }));
});

test("camera recognition maps food table and saves meal nutrition", async () => {
  const result = await platform.recognizeMeal({ playerId: "p1", date: today });
  assert.equal(result.items.length, 3);
  assert.ok(result.items.every((item) => item.name && item.grams > 0));
  assert.deepEqual(
    result.nutrition,
    await platform.previewNutrition(result.items),
  );
  const record = await platform.addRecord({
    ...result,
    playerId: "p1",
    date: today,
    meal: "午餐",
  });
  const loaded = (await platform.load()).records.find(
    (item) => item.id === record.id,
  );
  assert.deepEqual(loaded.nutrition, result.nutrition);
  assert.equal(loaded.recognitionId, result.recognitionId);
});
test("unmapped camera food and missing weight block preview and save", async () => {
  for (const items of [
    [{ foodId: "unknown", grams: 100 }],
    [{ foodId: "f1" }],
    [{ foodId: "f1", grams: 3001 }],
  ]) {
    await assert.rejects(() => platform.previewNutrition(items));
    await assert.rejects(() => platform.addRecord({ items }));
  }
});
