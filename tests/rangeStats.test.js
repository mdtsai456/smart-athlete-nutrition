/**
 * 時間區段營養統計測試。
 * 沒有紀錄的日期不計入達成率。
 * 達標需要熱量為目標的 80%–115%，且蛋白質至少為目標的 80%。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { datesInRange, playerRange, rangeBounds, rangeSummary } from "../js/services/rangeStats.js";

const player = {
  id: "p1",
  name: "陳柏宇",
  nutritionTargets: [['energy', 2000], ['protein', 100], ['carbohydrate', 200], ['fat', 60]].map(([nutrientId, targetMin]) => ({ athleteId: 'p1', nutrientId, targetMin, targetBasis: 'absolute', startDate: '2026-11-01' })),
  target: { calories: 2000, protein: 100, carbs: 200, fat: 60 },
};
const meal = (date, mealName, nutrition) => ({
  playerId: "p1",
  date,
  meal: mealName,
  status: "reviewed",
  nutrition,
});
const onTarget = { calories: 2000, protein: 100, carbs: 200, fat: 60 };

test("presets are inclusive and anchored on the viewed date", () => {
  assert.deepEqual(rangeBounds("today", "2026-11-16"), {
    start: "2026-11-16",
    end: "2026-11-16",
    preset: "today",
  });
  assert.deepEqual(rangeBounds("7", "2026-11-16"), {
    start: "2026-11-10",
    end: "2026-11-16",
    preset: "7",
  });
  assert.equal(datesInRange("2026-11-10", "2026-11-16").length, 7);
});

test("rates ignore empty days and a hit day needs calories and protein", () => {
  const dates = ["2026-11-15", "2026-11-16"];
  const row = playerRange(
    player,
    [
      meal("2026-11-16", "早餐", onTarget),
      meal("2026-11-16", "午餐", emptyNutrition()),
      meal("2026-11-16", "晚餐", emptyNutrition()),
    ],
    dates,
  );
  assert.equal(row.calorieRate, 100);
  assert.equal(row.proteinRate, 100);
  assert.equal(row.hitDays, 1);
  assert.equal(row.completeness, 50);
  assert.equal(row.status, "紀錄不足");
});

test("high calories and low carbs are labeled after the record is complete enough", () => {
  const dates = ["2026-11-16"];
  const high = playerRange(
    player,
    [
      meal("2026-11-16", "早餐", { calories: 2600, protein: 100, carbs: 80, fat: 60 }),
      meal("2026-11-16", "午餐", emptyNutrition()),
      meal("2026-11-16", "晚餐", emptyNutrition()),
    ],
    dates,
  );
  assert.equal(high.status, "熱量偏高");
  const lowCarb = playerRange(
    player,
    [
      meal("2026-11-16", "早餐", { calories: 2000, protein: 100, carbs: 80, fat: 60 }),
      meal("2026-11-16", "午餐", emptyNutrition()),
      meal("2026-11-16", "晚餐", emptyNutrition()),
    ],
    dates,
  );
  assert.equal(lowCarb.status, "碳水不足");
  assert.equal(lowCarb.hitDays, 1);
});

test("team averages skip players who recorded nothing", () => {
  const other = { ...player, id: "p2", name: "林冠廷" };
  const summary = rangeSummary(
    [player, other],
    [meal("2026-11-16", "早餐", onTarget), meal("2026-11-16", "午餐", emptyNutrition()), meal("2026-11-16", "晚餐", emptyNutrition())],
    ["2026-11-16"],
  );
  assert.equal(summary.calorieRate, 100);
  assert.equal(summary.completePlayers, 1);
  assert.equal(summary.attentionPlayers, 1);
});

function emptyNutrition() {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

// 每日計畫使用該日最新版本。其他日期使用當時有效的期間目標。
test("historical rates use each day's latest target", () => {
  const historical = {
    ...player,
    nutritionTargets: [
      { athleteId: 'p1', nutrientId: 'energy', startDate: '2026-11-01', targetBasis: 'absolute', targetMin: 2000 },
      { athleteId: 'p1', nutrientId: 'protein', startDate: '2026-11-01', targetBasis: 'absolute', targetMin: 100 },
    ],
    dailyPlans: [
      { athleteId: 'p1', localDate: '2026-11-16', revision: 2, target: { calories: 3000, protein: 150 } },
      { athleteId: 'p1', localDate: '2026-11-16', revision: 1, target: { calories: 1000, protein: 50 } },
    ],
  };
  const row = playerRange(historical, [
    meal('2026-11-15', '早餐', onTarget),
    meal('2026-11-16', '早餐', { calories: 3000, protein: 150 }),
  ], ['2026-11-15', '2026-11-16']);
  assert.equal(row.calorieRate, 100);
  assert.equal(row.proteinRate, 100);
  assert.equal(row.hitDays, 2);
});

test("records without items do not count as recorded days", () => {
  const row = playerRange(player, [{ ...meal('2026-11-16', '早餐', onTarget), items: [] }], ['2026-11-16']);
  assert.equal(row.recordedMeals, 0);
  assert.equal(row.calorieRate, null);
  assert.equal(row.hitDays, 0);
});

// 缺少歷史目標時，不得套用目前目標，也不得稀釋其他日期的達成率。
test("days without a target are excluded from average rates", () => {
  const row = playerRange({ ...player, nutritionTargets: [], dailyPlans: [
    { athleteId: 'p1', localDate: '2026-11-16', revision: 1, target: onTarget },
  ] }, [meal('2026-11-15', '早餐', onTarget), meal('2026-11-16', '早餐', onTarget)], ['2026-11-15', '2026-11-16']);
  assert.equal(row.calorieRate, 100);
  assert.equal(row.hitDays, 1);
});
