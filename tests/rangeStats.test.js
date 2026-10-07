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
