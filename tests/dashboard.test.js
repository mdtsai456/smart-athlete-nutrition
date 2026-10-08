/**
 * 球員首頁當日餐列測試。
 * 早餐、午餐、晚餐各保留一列。
 * 點心與同一餐的第二筆各顯示一列。
 * draft 不顯示。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { playerDaily } from "../js/services/dashboard.service.js";

test("snacks and extra meals stay visible on the player home", () => {
  const daily = playerDaily(
    {
      date: "2026-11-16",
      players: [{ id: "p1", totals: { protein: 40 }, target: { protein: 100 } }],
      records: [
        { date: "2026-11-16", playerId: "p1", status: "submitted", meal: "早餐", foodNames: "蛋", time: "08:15", at: "2026-11-16T00:15:00.000Z" },
        { date: "2026-11-16", playerId: "p1", status: "reviewed", meal: "早餐", foodNames: "麵包", time: "09:00", at: "2026-11-16T01:00:00.000Z" },
        { date: "2026-11-16", playerId: "p1", status: "submitted", meal: "點心", foodNames: "香蕉", time: "16:00", at: "2026-11-16T08:00:00.000Z", items: [{ id: "snack" }] },
        { date: "2026-11-16", playerId: "p1", status: "submitted", meal: "點心", foodNames: "已刪除", time: "18:00", at: "2026-11-16T10:00:00.000Z", items: [] },
        { date: "2026-11-16", playerId: "p1", status: "draft", meal: "點心", foodNames: "草稿不顯示", at: "2026-11-16T09:00:00.000Z" },
        { date: "2026-11-15", playerId: "p1", status: "submitted", meal: "點心", foodNames: "昨天不顯示", at: "2026-11-15T08:00:00.000Z" },
      ],
    },
    "p1",
  );
  assert.deepEqual(
    daily.meals.map((meal) => [meal.meal, meal.actual, meal.recorded]),
    [
      ["早餐 08:15", "蛋", true],
      ["早餐 09:00", "麵包", true],
      ["午餐", "", false],
      ["晚餐", "", false],
      ["點心", "香蕉", true],
    ],
  );
  assert.equal(daily.recordedCount, 1);
});

// 訓練前後的餐點須顯示，但不增加三餐紀錄數。
test("training meals remain visible without counting as main meals", () => {
  const daily = playerDaily({
    date: '2026-11-16', players: [],
    records: ['訓練前', '訓練後'].map(meal => ({ playerId: 'p1', date: '2026-11-16', status: 'submitted', meal, foodNames: '香蕉', items: [{ id: meal }] })),
  });
  assert.deepEqual(daily.meals.slice(3).map(row => row.meal), ['訓練前', '訓練後']);
  assert.equal(daily.recordedCount, 0);
});
