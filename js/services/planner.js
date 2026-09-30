/** Pure macro allocation and validation. Inputs are dietitian decisions, not prescriptions. */
export const ENERGY_TOLERANCE = 5;
// Editable prototype defaults; final requirements are set by the dietitian.
export const CARB_DAY_PRESETS = Object.freeze({ 訓練日: 6, 休息日: 4 });
export function changePlanDay(input, training) {
  if (!Object.hasOwn(CARB_DAY_PRESETS, training))
    throw new Error("請選擇訓練日或休息日。");
  return { ...input, training, carbMinimum: CARB_DAY_PRESETS[training] };
}
const round = (value) => Math.round((value + Number.EPSILON) * 10) / 10;
export function planDraft(player, date) {
  const saved = player.nutritionPlans?.[date];
  if (saved?.input) {
    const { mode, carbsKg, ...draft } = structuredClone(saved.input);
    draft.training = ["休息日", "休息／體態日"].includes(draft.training)
      ? "休息日"
      : "訓練日";
    // Preserve confirmed legacy targets when retiring the old allocation algorithm.
    if (mode === "performance" && saved.target)
      Object.assign(draft, saved.target, { manual: true });
    return draft;
  }
  return {
    weight: player.weight,
    calories: player.target.calories,
    proteinKg: 1.6,
    fatUnit: "kg",
    fatValue: 1,
    carbMinimum: CARB_DAY_PRESETS.訓練日,
    training: "訓練日",
    manual: false,
  };
}
export function calculatePlan(input) {
  const n = Object.fromEntries(
    ["weight", "calories", "proteinKg", "fatValue", "carbMinimum"].map(
      (key) => [key, Number(input[key])],
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
  // 維持總熱量優先：蛋白質與脂肪扣除後，剩餘熱量每 4 kcal 換算 1 g 碳水。
  let carbs = (n.calories - protein * 4 - fat * 9) / 4;
  if (input.manual) {
    protein = Number(input.protein);
    carbs = Number(input.carbs);
    fat = Number(input.fat);
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
