/**
 * 飲食營養計算。
 * 目錄數值來自 FoodNutrient。
 * 已確認攝取只加總 MealItemNutrient。
 * 計算不讀取之後修改的食物表。
 */
import { MAIN_MEALS, mealHasItems } from "./dashboard.service.js";
const KEYS = {
  energy: "calories",
  protein: "protein",
  carbohydrate: "carbs",
  fat: "fat",
};
const empty = () => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });
/** 用目前食物表的每 100 g 乘上重量。 */
export function nutrition(items, foodNutrients) {
  const sum = empty();
  for (const item of items) {
    const grams = item.grams ?? item.confirmedWeightG ?? item.estimatedWeightG;
    if (!Number.isFinite(grams)) continue;
    for (const row of foodNutrients) {
      if (row.foodId !== item.foodId) continue;
      const key = KEYS[row.nutrientId];
      if (key) sum[key] += (row.amountPer100g * grams) / 100;
    }
  }
  return sum;
}
/** 用確認當下寫入的營養資料。之後改食物表不影響。 */
export function nutritionFromSnapshots(itemIds, snapshots) {
  const sum = empty();
  const ids = new Set(itemIds);
  for (const row of snapshots) {
    if (!ids.has(row.mealItemId)) continue;
    const key = KEYS[row.nutrientId];
    if (key) sum[key] += row.amount;
  }
  return sum;
}
export function roundedNutrition(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, amount]) => [key, Math.round(amount)]),
  );
}
export function presentFood(food, foodNutrients) {
  const per100g = { calories: null, protein: null, carbs: null, fat: null };
  for (const row of foodNutrients) {
    if (row.foodId !== food.id) continue;
    const key = KEYS[row.nutrientId];
    if (key) per100g[key] = row.amountPer100g;
  }
  return { ...food, category: food.foodType, ...per100g };
}
function intakeTone(rate) {
  if (rate == null) return { status: "未設定", tone: "neutral" };
  if (rate < 60) return { status: "待關注", tone: "orange" };
  if (rate > 110) return { status: "攝取偏高", tone: "red" };
  return { status: "進度良好", tone: "green" };
}
/** 當日已送出且有項目的餐。草稿不計入。 */
export function playerSummary(player, records, date) {
  const meals = records.filter(
    (record) =>
      record.playerId === player.id &&
      record.date === date &&
      record.status !== "draft" &&
      mealHasItems(record),
  );
  const exact = meals.reduce((sum, record) => {
    const source = record.nutritionExact || record.nutrition;
    for (const key of Object.keys(sum)) sum[key] += source[key] || 0;
    return sum;
  }, empty());
  const totals = roundedNutrition(exact);
  const calorieTarget = player.target?.calories;
  const rate = calorieTarget
    ? Math.round((totals.calories / calorieTarget) * 100)
    : null;
  return {
    ...player,
    totals,
    rate,
    completion: Math.round(
      (new Set(
        meals
          .map((record) => record.meal)
          .filter((meal) => MAIN_MEALS.includes(meal)),
      ).size /
        MAIN_MEALS.length) *
        100,
    ),
    ...intakeTone(rate),
  };
}
