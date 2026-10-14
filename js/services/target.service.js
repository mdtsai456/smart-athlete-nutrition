/**
 * 計算訓練日與休息日的蛋白質、脂肪、剩餘碳水與熱量。
 * 此模組不儲存資料。
 */

/**
 * 取得或初始化球員的訓練日／休息日兩組目標範本
 * @param {string} athleteId 
 * @returns {Object} 包含 training 與 rest 兩組目標
 */
export function getAthleteTargetTemplates(athleteId) {
    // 模擬從 localStorage 或狀態讀取兩組範本，若無則給予預設起始值
    const stored = localStorage.getItem(`target_templates_${athleteId}`);
    if (stored) {
        return JSON.parse(stored);
    }
    
    // 預設起始值：總熱量 2800 kcal，蛋白質 1.6 g/kg，脂肪 1 g/kg
    return {
        training: {
            calories: 2800,
            proteinPerKg: 1.6,
            fatPerKg: 1.0,
            carbMinPerKg: 6.0 // 訓練日碳水最低需求 6 g/kg
        },
        rest: {
            calories: 2400,
            proteinPerKg: 1.4,
            fatPerKg: 1.0,
            carbMinPerKg: 4.0 // 休息日碳水最低需求 4 g/kg
        }
    };
}

/**
 * 儲存球員的訓練日／休息日兩組目標範本
 * @param {string} athleteId 
 * @param {Object} templates 
 */
export function saveAthleteTargetTemplates(athleteId, templates) {
    localStorage.setItem(`target_templates_${athleteId}`, JSON.stringify(templates));
}

/**
 * 驗算營養數值與熱量差距，並檢查碳水底線
 * @param {Object} target 
 * @param {number} weight 
 * @returns {Object} 驗算結果（diff, isValidCarb, warnings）
 */
export function validateTargetValues(target, weight) {
  const calories = Number(target.calories);
  const proteinPerKg = Number(target.proteinPerKg);
  const fatPerKg = Number(target.fatPerKg);
  const carbMinPerKg = Number(target.carbMinPerKg);
  const bodyWeight = Number(weight);

  const validInputs = [
    calories,
    proteinPerKg,
    fatPerKg,
    carbMinPerKg,
    bodyWeight,
  ].every(Number.isFinite);

  if (
    !validInputs ||
    calories <= 0 ||
    proteinPerKg <= 0 ||
    fatPerKg <= 0 ||
    carbMinPerKg < 0 ||
    bodyWeight <= 0
  ) {
    return {
      calculatedCarbs: null,
      minCarbs: null,
      energy: null,
      difference: null,
      isValidCarb: false,
      isCalorieMatch: false,
      valid: false,
      errors: ["請輸入有效的熱量、體重與營養素目標。"],
    };
  }

  const protein = proteinPerKg * bodyWeight;
  const fat = fatPerKg * bodyWeight;
  const calculatedCarbs =
    (calories - protein * 4 - fat * 9) / 4;
  const minCarbs = carbMinPerKg * bodyWeight;

  const energy = protein * 4 + calculatedCarbs * 4 + fat * 9;
  const difference = Math.round((energy - calories) * 10) / 10;

  const isValidCarb =
    calculatedCarbs >= minCarbs && calculatedCarbs >= 0;

  const isCalorieMatch =
    Math.abs(difference) <= ENERGY_TOLERANCE;

  return {
    protein,
    fat,
    calculatedCarbs,
    minCarbs,
    energy,
    difference,
    isValidCarb,
    isCalorieMatch,
    valid: isCalorieMatch && calculatedCarbs >= 0,
    errors: [
      ...(calculatedCarbs < 0
        ? ["蛋白質與脂肪已超出熱量預算，無法分配碳水。"]
        : []),
      ...(!isCalorieMatch
        ? [`熱量差距超過容許範圍 ±${ENERGY_TOLERANCE} kcal。`]
        : []),
    ],
  };
}
export const ENERGY_TOLERANCE = 5;
// 營養師可以修改預設值，並儲存確認後的目標。
export const CARB_DAY_PRESETS = Object.freeze({ 訓練日: 6, 休息日: 4 });
export function changePlanDay(input, training) {
  if (!Object.hasOwn(CARB_DAY_PRESETS, training))
    throw new Error("請選擇訓練日或休息日。");
  return { ...input, training, carbMinimum: CARB_DAY_PRESETS[training] };
}
const round = (value) => Math.round((value + Number.EPSILON) * 10) / 10;
export function shiftDate(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
/** 取得指定球員與日期的最新計畫，不修改原始陣列。 */
export function latestDailyPlan(plans, athleteId, date) {
  return (plans || []).reduce((latest, row) =>
    row.athleteId === athleteId && row.localDate === date &&
    (!latest || row.revision > latest.revision) ? row : latest, null);
}
export function activeTargetRows(rows, athleteId, date) {
  return (rows || []).filter(
    (row) =>
      row.athleteId === athleteId &&
      row.startDate <= date &&
      (row.endDate == null || row.endDate >= date),
  );
}
/** 優先使用當日計畫。沒有目標時，顯示未設定。不要將未設定的目標視為 0。計算每公斤目標時需要體重。 */
export function resolveTarget(player, rows, date, dailyPlan) {
  if (dailyPlan?.target) return { ...dailyPlan.target, source: "daily" };
  const active = activeTargetRows(rows, player.id, date);
  if (!active.length)
    return { calories: null, protein: null, carbs: null, fat: null, source: "unset" };
  const weight = Number(player.weight);
  const byNutrient = Object.fromEntries(active.map((row) => [row.nutrientId, row]));
  const read = (nutrientId) => {
    const row = byNutrient[nutrientId];
    if (!row) return null;
    if (row.targetBasis === "per_kg_bw" && !(weight > 0)) return null;
    const raw =
      row.targetBasis === "per_kg_bw" ? row.targetMin * weight : row.targetMin;
    return round(raw);
  };
  return {
    calories: read("energy"),
    protein: read("protein"),
    carbs: read("carbohydrate"),
    fat: read("fat"),
    source: "policy",
  };
}
function gramsOf(row, weight) {
  return row.targetBasis === "per_kg_bw" ? row.targetMin * weight : row.targetMin;
}
/** 有當日計畫時，載入該計畫的草稿。否則使用期間政策的預設值。 */
export function planDraft(player, date) {
  if (player.dailyPlan?.localDate === date && player.dailyPlan.inputJson)
    return { ...player.dailyPlan.inputJson };
  const weight = Number(player.weight);
  const base = {
    weight,
    calories: player.target?.calories ?? 2800,
    proteinKg: 1.6,
    fatUnit: "kg",
    fatValue: 1,
    carbMinimum: CARB_DAY_PRESETS.訓練日,
    training: "訓練日",
    manual: false,
  };
  const rows = activeTargetRows(player.nutritionTargets, player.id, date);
  if (!rows.length) return base;
  const byNutrient = Object.fromEntries(rows.map((row) => [row.nutrientId, row]));
  const energy = byNutrient.energy;
  const protein = byNutrient.protein;
  const fat = byNutrient.fat;
  const carbs = byNutrient.carbohydrate;
  const automatic =
    protein?.targetBasis === "per_kg_bw" &&
    fat?.targetBasis === "per_kg_bw" &&
    energy?.targetBasis === "absolute" &&
    carbs?.targetBasis === "absolute";
  if (!automatic)
    return {
      ...base,
      calories: energy ? gramsOf(energy, weight) : base.calories,
      manual: true,
      protein: protein ? round(gramsOf(protein, weight)) : 0,
      fat: fat ? round(gramsOf(fat, weight)) : 0,
      carbs: carbs ? round(gramsOf(carbs, weight)) : 0,
    };
  return {
    ...base,
    calories: energy.targetMin,
    proteinKg: protein.targetMin,
    fatValue: fat.targetMin,
  };
}
/** 先扣除蛋白質與脂肪的熱量，再將剩餘熱量換算為碳水。營養素合計與總熱量相差超過 5 kcal 時，驗證失敗。 */
// 空白、null 與布林值不是營養數值。保留數字字串，供表單輸入使用。
function inputNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") return NaN;
  if (typeof value === "string" && !value.trim()) return NaN;
  return Number(value);
}
export function calculatePlan(input) {
  const n = Object.fromEntries(
    ["weight", "calories", "proteinKg", "fatValue", "carbMinimum"].map(
      (key) => [key, inputNumber(input[key])],
    ),
  );
  const errors = [],
    warnings = [];
  if (!["訓練日", "休息日"].includes(input.training))
    errors.push("請選擇訓練日或休息日。");
  if (!["kg", "percent"].includes(input.fatUnit))
    errors.push("請選擇脂肪底線單位。");
  if (
    Object.values(n).some((v) => !Number.isFinite(v)) ||
    n.weight <= 0 ||
    n.calories <= 0 ||
    n.proteinKg <= 0 ||
    n.fatValue <= 0 ||
    n.carbMinimum < 0
  )
    errors.push("請輸入有效數字；體重、熱量、蛋白質與脂肪底線須大於 0。");
  if (input.fatUnit === "percent" && n.fatValue > 100)
    errors.push("脂肪百分比不得超過 100%。");
  if (errors.length) return { errors, warnings, valid: false, target: null };
  const fatFloor =
    input.fatUnit === "percent"
      ? (n.calories * n.fatValue) / 100 / 9
      : n.weight * n.fatValue;
  let protein = n.weight * n.proteinKg;
  let fat = fatFloor;
  // 扣除蛋白質與脂肪的熱量後，將剩餘熱量以每 4 kcal 換算為 1 g 碳水。
  let carbs = (n.calories - protein * 4 - fat * 9) / 4;
  if (input.manual) {
    protein = inputNumber(input.protein);
    carbs = inputNumber(input.carbs);
    fat = inputNumber(input.fat);
    if ([protein, carbs, fat].some((v) => !Number.isFinite(v) || v < 0))
      errors.push("手動目標須為有效且不小於 0 的數字。");
  }
  if ([protein, carbs, fat, fatFloor].some((value) => !Number.isFinite(value)))
    errors.push("數值超出可計算範圍，請重新輸入。");
  if ([protein, carbs, fat].some((v) => v < 0))
    errors.push("熱量預算不足，剩餘營養素為負值。請提高總熱量或調整前項目標。");
  if (errors.length) return { errors, warnings, valid: false, target: null };
  const target = {
    calories: n.calories,
    protein: round(protein),
    carbs: round(carbs),
    fat: round(fat),
  };
  const energy = round(target.protein * 4 + target.carbs * 4 + target.fat * 9);
  const difference = round(energy - n.calories);
  const carbRate = round(target.carbs / n.weight);
  if (Math.abs(difference) > ENERGY_TOLERANCE)
    errors.push(
      `營養素合計與總熱量相差 ${Math.abs(difference)} kcal，請調整至 ±${ENERGY_TOLERANCE} kcal 內。`,
    );
  if (target.carbs + 0.1 < n.weight * n.carbMinimum)
    warnings.push(
      "碳水低於您設定的當日最低需求。可提高總熱量、調整脂肪，或重新檢查需求設定。",
    );
  if (target.fat + 0.1 < fatFloor)
    warnings.push("脂肪低於您設定的底線。請調整總熱量或營養目標。");
  if (input.manual && target.protein + 0.1 < n.weight * n.proteinKg)
    warnings.push("手動蛋白質低於原訂 g/kg 目標，請確認。");
  return {
    target,
    energy,
    difference,
    carbRate,
    training: input.training,
    carbMinimum: n.carbMinimum,
    carbRequired: round(n.weight * n.carbMinimum),
    carbShortfall: round(Math.max(0, n.weight * n.carbMinimum - target.carbs)),
    fatFloor: round(fatFloor),
    fatRate: round(target.fat / n.weight),
    proteinEnergy: round(target.protein * 4),
    carbsEnergy: round(target.carbs * 4),
    fatEnergy: round(target.fat * 9),
    errors,
    warnings,
    valid: !errors.length,
  };
}
/** 有提醒時必須勾選確認才可儲存。 */
export function confirmedPlan(input, reviewed) {
  const result = calculatePlan(input);
  if (!result.valid) throw new Error(result.errors.join(" "));
  if (result.warnings.length && !reviewed)
    throw new Error("請先檢查提醒，再勾選確認，或調整目標。");
  const { mode, carbsKg, ...currentInput } = input;
  return {
    input: structuredClone(currentInput),
    target: result.target,
    reviewed: !!reviewed,
    warnings: result.warnings,
    confirmedAt: new Date().toISOString(),
  };
}
