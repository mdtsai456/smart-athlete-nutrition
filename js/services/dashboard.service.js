/**
 * 首頁餐列資料。
 * 早餐、午餐、晚餐各保留一列。
 * 同一餐的第二筆、點心與訓練前後的餐各顯示一列。
 * 沒有項目的餐與 draft 不顯示。
 */
export const MAIN_MEALS = ["早餐", "午餐", "晚餐"];
export function mealHasItems(record) {
  return !Array.isArray(record.items) || record.items.length > 0;
}
function byTime(a, b) {
  return (a.time || "").localeCompare(b.time || "") || (a.at || "").localeCompare(b.at || "");
}
function mealRows(mealName, records) {
  if (!records.length) return [{ meal: mealName, actual: "", recorded: false }];
  const showTime = records.length > 1;
  return [...records].sort(byTime).map((record) => ({
    meal: showTime && record.time ? `${mealName} ${record.time}` : mealName,
    actual: record.foodNames || "",
    recorded: true,
  }));
}
/** 早餐、午餐與晚餐各顯示至少一列。同餐的其他紀錄與點心分列顯示，並標示時間。 */
export function playerDaily(data, playerId = "p1") {
  const player = data.players.find((item) => item.id === playerId);
  const records = data.records.filter(
    (record) =>
      record.date === data.date &&
      record.playerId === playerId &&
      record.status !== "draft" &&
      mealHasItems(record),
  );
  const ofMeal = (meal) => records.filter((record) => record.meal === meal);
  const extraMeals = [...new Set(records.map((record) => record.meal))]
    .filter((meal) => !MAIN_MEALS.includes(meal));
  const meals = [
    ...MAIN_MEALS.flatMap((meal) => mealRows(meal, ofMeal(meal))),
    ...extraMeals.flatMap((meal) => mealRows(meal, ofMeal(meal))),
  ];
  return {
    player,
    meals,
    recordedCount: MAIN_MEALS.filter((meal) => ofMeal(meal).length > 0).length,
    proteinRate: player?.target?.protein
      ? Math.round((player.totals.protein / player.target.protein) * 100)
      : null,
  };
}
