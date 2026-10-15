/**
 * 菜色寫入。
 * 預覽不寫入資料。此模組負責寫入食物主檔。
 */
import { collection } from "../api/api.js";
import { foodNutrients, foods } from "../api/food.api.js";
import { nutrients } from "../api/seed.js";

export async function addFood(data) {
  const food = await foods.create({
    name: data.name,
    foodType: data.category || data.foodType,
    status: "active",
  });
  const amounts = {
    energy: data.calories,
    protein: data.protein,
    carbohydrate: data.carbs,
    fat: data.fat,
  };
  for (const nutrient of nutrients) {
    await foodNutrients.create({
      foodId: food.id,
      nutrientId: nutrient.id,
      amountPer100g: Number(amounts[nutrient.id]),
    });
  }
  return food;
}
/** 某列寫入失敗時，撤回該列的變更，並繼續處理其他列。 */
export async function importFoods(rows) {
  const written = [];
  const failed = [];
  const names = new Set((await foods.list()).map((food) => food.name));
  for (const row of rows) {
    let food = null;
    try {
      if (names.has(row.name)) throw new Error("資料庫已有同名菜色");
      food = await foods.create({
        name: row.name,
        foodType: row.foodType || "未分類",
        brand: row.brand || null,
        description: row.description || null,
        source: row.source || null,
        sourceFoodCode: row.sourceFoodCode || null,
        density: row.density,
        status: "active",
      });
      for (const [nutrientId, amountPer100g] of Object.entries(row.amounts)) {
        await foodNutrients.create({ foodId: food.id, nutrientId, amountPer100g });
      }
      names.add(row.name);
      written.push(row);
    } catch (error) {
      if (food) {
        const created = (await foodNutrients.list()).filter((item) => item.foodId === food.id);
        for (const item of created) await foodNutrients.remove(item.id);
        await foods.remove(food.id);
      }
      failed.push({ ...row, reasons: [error.message] });
    }
  }
  return { written, failed };
}
/** 不得刪除飲食紀錄已使用的菜色。 */
export async function deleteFood(id) {
  const [mealItems, nutrientRows] = await Promise.all([
    collection("mealItems").list(),
    foodNutrients.list(),
  ]);
  if (mealItems.some((item) => item.foodId === id))
    throw new Error("這道菜已用在飲食紀錄，不能刪除");
  const rows = nutrientRows.filter((item) => item.foodId === id);
  for (const item of rows) await foodNutrients.remove(item.id);
  await foods.remove(id);
}
