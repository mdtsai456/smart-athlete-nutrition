/**
 * 菜色 Excel 預覽。
 * 這一層只判斷可寫入與不可寫入。
 * 它不寫入食物主檔。
 */
export const NUTRIENT_LABEL = {
  energy: "熱量",
  protein: "蛋白質",
  carbohydrate: "碳水",
  fat: "脂肪",
};
const HEADER_FIELDS = [
  ["name", ["菜色名稱", "菜名", "名稱", "食物名稱", "food_name", "foodname", "name"]],
  ["foodType", ["分類", "菜色分類", "food_type", "foodtype", "category"]],
  ["brand", ["品牌", "brand"]],
  ["description", ["說明", "描述", "description"]],
  ["source", ["來源", "source"]],
  ["sourceFoodCode", ["來源代碼", "source_food_code", "sourcefoodcode"]],
  ["density", ["密度", "density_g_per_ml", "density"]],
  ["energy", ["熱量", "kcal", "calories", "energy", "enerc"]],
  ["protein", ["蛋白質", "protein", "prot"]],
  ["carbohydrate", ["碳水", "碳水化合物", "carbs", "carbohydrate", "cho"]],
  ["fat", ["脂肪", "fat"]],
  ["emoji", ["圖示", "emoji", "圖"]],
];
function cellText(value) {
  return String(value ?? "").trim();
}
function headerKey(value) {
  return cellText(value).toLowerCase().replace(/\s+/g, "").replace(/[（(].*?[）)]/g, "");
}
export function blankResult(fileError) {
  return { fileError, ignoredColumns: [], ready: [], rejected: [] };
}
function parseEmoji(value) {
  const text = cellText(value);
  if (!text) return { empty: true };
  if ([...text].length > 4 || /[\p{Letter}\p{Number}]/u.test(text))
    return { error: "圖示請填一個圖" };
  return { value: text };
}
function parseAmount(value) {
  if (value == null || cellText(value) === "") return { empty: true };
  const number = typeof value === "number" ? value : Number(cellText(value).replace(/,/g, ""));
  if (!Number.isFinite(number)) return { error: "不是數字" };
  if (number < 0) return { error: "不可小於 0" };
  return { value: number };
}
function mapHeaders(header) {
  const columns = {};
  const ignoredColumns = [];
  const used = new Map();
  header.forEach((label, index) => {
    const key = headerKey(label);
    if (!key) return;
    const field = HEADER_FIELDS.find(([, names]) => names.includes(key))?.[0];
    if (!field) {
      ignoredColumns.push(cellText(label));
      return;
    }
    if (used.has(field)) used.get(field).push(cellText(label));
    else used.set(field, [cellText(label)]);
    columns[field] = index;
  });
  const duplicate = [...used.values()].find((labels) => labels.length > 1);
  return { columns, ignoredColumns, duplicate };
}

/** 空白營養格略過。同名、負數與對不到的標題列不寫入。 */
export function previewFoodImport(rows, existingNames = []) {
  if (!Array.isArray(rows) || !rows.length) return blankResult("檔案沒有資料列");
  const header = rows[0].map((cell) => cellText(cell));
  if (header.every((cell) => !cell)) return blankResult("找不到標題列");
  const mapped = mapHeaders(header);
  if (mapped.duplicate) return blankResult(`標題重複：${mapped.duplicate.join("、")}`);
  if (mapped.columns.name == null) return blankResult("標題列沒有菜色名稱");
  const existing = new Set(existingNames.map((name) => cellText(name)));
  const seen = new Set();
  const ready = [];
  const rejected = [];
  rows.slice(1).forEach((row, index) => {
    if (!row.some((cell) => cellText(cell) !== "")) return;
    const line = index + 2;
    const reasons = [];
    const name = cellText(row[mapped.columns.name]);
    if (!name) reasons.push("缺少菜名");
    else if (name.length > 150) reasons.push("菜名超過 150 字");
    const textField = (field, limit, label) => {
      const column = mapped.columns[field];
      const value = column == null ? "" : cellText(row[column]);
      if (value.length > limit) reasons.push(`${label}超過 ${limit} 字`);
      return value;
    };
    const foodType = textField("foodType", 100, "分類");
    const brand = textField("brand", 150, "品牌");
    const description = textField("description", 2000, "說明");
    const source = textField("source", 100, "來源");
    const sourceFoodCode = textField("sourceFoodCode", 100, "來源代碼");
    if ((source && !sourceFoodCode) || (!source && sourceFoodCode))
      reasons.push("來源與來源代碼要同時填，或同時留空");
    let density = null;
    if (mapped.columns.density != null) {
      const parsed = parseAmount(row[mapped.columns.density]);
      if (parsed.error) reasons.push(`密度${parsed.error}`);
      else if (!parsed.empty && parsed.value <= 0) reasons.push("密度要大於 0");
      else if (!parsed.empty) density = parsed.value;
    }
    const amounts = {};
    let nutrientErrors = 0;
    for (const field of Object.keys(NUTRIENT_LABEL)) {
      const column = mapped.columns[field];
      if (column == null) continue;
      const parsed = parseAmount(row[column]);
      if (parsed.empty) continue;
      if (parsed.error) {
        nutrientErrors += 1;
        reasons.push(`${NUTRIENT_LABEL[field]}${parsed.error}`);
      } else amounts[field] = parsed.value;
    }
    if (!Object.keys(amounts).length && nutrientErrors === 0)
      reasons.push("至少要有一項營養數字");
    let emoji = "";
    if (mapped.columns.emoji != null) {
      const parsed = parseEmoji(row[mapped.columns.emoji]);
      if (parsed.error) reasons.push(parsed.error);
      else if (!parsed.empty) emoji = parsed.value;
    }
    if (name && !reasons.length) {
      if (seen.has(name)) reasons.push("這份檔案裡已有同名菜色");
      else if (existing.has(name)) reasons.push("資料庫已有同名菜色");
    }
    const item = {
      row: line,
      name,
      foodType,
      brand,
      description,
      source,
      sourceFoodCode,
      density,
      emoji,
      amounts,
      reasons,
    };
    if (reasons.length) rejected.push(item);
    else {
      seen.add(name);
      ready.push(item);
    }
  });
  if (!ready.length && !rejected.length) return blankResult("標題列下面沒有資料");
  return { fileError: "", ignoredColumns: mapped.ignoredColumns, ready, rejected };
}
