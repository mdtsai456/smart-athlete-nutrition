/**
 * 菜色 Excel 匯入測試。
 * 正確列可寫入。
 * 錯誤列留在預覽。
 * 寫入失敗的列會撤回。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { previewFoodImport } from "../js/utils/food-import.js";
import { foodEmoji, foodImageUrl, UNCATEGORIZED_EMOJI } from "../js/utils/food-emoji.js";
import { view } from "../js/pages/shared/screens.js";
import { rowsToXlsx, xlsxToRows } from "../js/utils/xlsx.js";
import { signIn } from "../js/api/session.js";
import { deleteFood, importFoods } from "../js/services/food.service.js";
import { loadPage } from "../js/services/workspace.service.js";

const rightRows = [
  ["菜色名稱", "分類", "品牌", "熱量", "蛋白質", "碳水化合物", "脂肪", "備註"],
  ["清蒸魚", "蛋白質", "", 104, 22, 0, 1.2, "可省略"],
  ["希臘優格", "乳品", "示範品牌", 97, 9, 3.6, 5, ""],
];
const wrongRows = [
  ["food name", "category", "calories", "protein", "carbs", "fat", "source", "source_food_code"],
  ["味噌湯", "蔬菜", 37, 2, 4, 1, "", ""],
  ["", "蛋白質", 10, 1, 0, 0, "", ""],
  ["烤地瓜", "全穀雜糧", 115, 1.3, 27, -1, "", ""],
  ["味噌湯", "蔬菜", 40, 2, 5, 1, "", ""],
  ["香煎雞胸肉", "蛋白質", 165, 31, 0, 3.6, "", ""],
  ["只有來源", "蛋白質", 10, 1, 0, 0, "食藥署", ""],
  ["空營養", "水果", "", "", "", "", "", ""],
];

function sample(name) {
  return readFileSync(new URL(`../samples/${name}`, import.meta.url));
}

test("right workbook previews two foods and ignores the extra column", async () => {
  const rows = await xlsxToRows(await rowsToXlsx(rightRows));
  const preview = previewFoodImport(rows, ["香煎雞胸肉"]);
  assert.equal(preview.fileError, "");
  assert.deepEqual(preview.ignoredColumns, ["備註"]);
  assert.equal(preview.rejected.length, 0);
  assert.deepEqual(
    preview.ready.map((row) => row.name),
    ["清蒸魚", "希臘優格"],
  );
  assert.equal(preview.ready[1].brand, "示範品牌");
  assert.equal(preview.ready[0].amounts.fat, 1.2);
});

test("wrong workbook keeps one writable row and names each rejected row", async () => {
  const preview = previewFoodImport(await xlsxToRows(await rowsToXlsx(wrongRows)), [
    "香煎雞胸肉",
  ]);
  assert.deepEqual(
    preview.ready.map((row) => row.name),
    ["味噌湯"],
  );
  const reasons = Object.fromEntries(preview.rejected.map((row) => [row.row, row.reasons.join("；")]));
  assert.match(reasons[3], /缺少菜名/);
  assert.match(reasons[4], /脂肪不可小於 0/);
  assert.match(reasons[5], /這份檔案裡已有同名菜色/);
  assert.match(reasons[6], /資料庫已有同名菜色/);
  assert.match(reasons[7], /來源與來源代碼要同時填/);
  assert.match(reasons[8], /至少要有一項營養數字/);
});

test("a header-only sheet and a broken file stop before any row is accepted", async () => {
  const headerOnly = previewFoodImport(await xlsxToRows(sample("菜色匯入-只有標題.xlsx")));
  assert.equal(headerOnly.fileError, "標題列下面沒有資料");
  assert.equal(headerOnly.ready.length, 0);
  await assert.rejects(() => xlsxToRows(sample("菜色匯入-壞檔.xlsx")), /這個檔案不是 Excel/);
});

test("confirm writes the ready row and leaves an existing name unchanged", async () => {
  await signIn("acct-n1");
  const before = await loadPage();
  const preview = previewFoodImport(rightRows, before.foods.map((food) => food.name));
  const result = await importFoods(preview.ready);
  assert.equal(result.failed.length, 0);
  const after = await loadPage();
  const added = after.foods.find((food) => food.name === "清蒸魚");
  assert.equal(added.calories, 104);
  assert.equal(added.protein, 22);
  assert.equal(added.category, "蛋白質");
  const again = await importFoods([preview.ready[0]]);
  assert.match(again.failed[0].reasons[0], /資料庫已有同名菜色/);
  const finalFoods = (await loadPage()).foods.filter((food) => food.name === "清蒸魚");
  assert.equal(finalFoods.length, 1);
  assert.equal(foodEmoji(finalFoods[0]), "🥩");
});

test("each category uses one emoji and a readable image replaces it", () => {
  assert.equal(foodEmoji({ name: "香煎雞胸肉", foodType: "蛋白質" }), "🥩");
  assert.equal(foodEmoji({ name: "水煮蛋", category: "蛋白質" }), "🥩");
  assert.equal(foodEmoji({ name: "糙米飯", category: "全穀雜糧" }), "🌾");
  assert.equal(foodEmoji({ name: "清炒花椰菜", category: "蔬菜" }), "🥦");
  assert.equal(foodEmoji({ name: "蘋果", category: "水果" }), "🍎");
  assert.equal(foodEmoji({ name: "希臘優格", category: "乳品" }), "🥛");
  assert.equal(foodEmoji({ name: "橄欖油", category: "油脂" }), "🫒");
  assert.equal(foodEmoji({ name: "未命名", category: "未分類" }), UNCATEGORIZED_EMOJI);
  assert.equal(foodEmoji({ name: "自訂分類", foodType: "點心" }), UNCATEGORIZED_EMOJI);
  assert.equal(foodImageUrl({ objectKey: "foods/a.jpg" }), "");
  assert.equal(foodImageUrl({ imageUrl: "foods/a.jpg" }), "");
  assert.equal(foodImageUrl({ imageUrl: "https://example.com/yogurt.jpg" }), "https://example.com/yogurt.jpg");
  const html = view("foods", {
    foods: [
      { id: "a", name: "希臘優格", category: "乳品", calories: 97, protein: 9, carbs: 3.6, fat: 5 },
      { id: "b", name: "希臘優格照片", category: "乳品", calories: 97, protein: 9, carbs: 3.6, fat: 5, imageUrl: "https://example.com/yogurt.jpg" },
    ],
  }, "nutritionist");
  assert.match(html, /🥛/);
  assert.match(html, /src="https:\/\/example.com\/yogurt.jpg"/);
});

test("an emoji column is listed and not written", async () => {
  const rows = [
    ["菜色名稱", "熱量", "圖示"],
    ["味噌湯", 37, "🍕"],
    ["青江菜", 20, "青菜"],
  ];
  const preview = previewFoodImport(await xlsxToRows(await rowsToXlsx(rows)));
  assert.deepEqual(preview.ignoredColumns, ["圖示"]);
  assert.equal(preview.rejected.length, 0);
  assert.deepEqual(preview.ready.map((row) => row.name), ["味噌湯", "青江菜"]);
});

test("delete removes an unused food and keeps a food used by a meal", async () => {
  await signIn("acct-n1");
  const preview = previewFoodImport(
    [
      ["菜色名稱", "熱量"],
      ["刪除測試菜", 10],
    ],
    (await loadPage()).foods.map((food) => food.name),
  );
  const created = await importFoods(preview.ready);
  assert.equal(created.failed.length, 0);
  const food = (await loadPage()).foods.find((item) => item.name === "刪除測試菜");
  await deleteFood(food.id);
  assert.equal((await loadPage()).foods.some((item) => item.id === food.id), false);
  await assert.rejects(() => deleteFood("f1"), /這道菜已用在飲食紀錄，不能刪除/);
});
