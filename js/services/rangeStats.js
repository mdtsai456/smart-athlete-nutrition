/**
 * 時間區段營養統計。
 * 達成率使用各日目標，只計算有紀錄且有目標的日期。
 * 達標日的熱量是目標的 80%–115%。
 * 達標日的蛋白質至少是目標的 80%。
 */
import { MAIN_MEALS, mealHasItems } from "./dashboard.service.js";
import { latestDailyPlan, resolveTarget, shiftDate } from "./target.service.js";
const empty = () => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });

export function datesInRange(start, end) {
  const dates = [];
  let cursor = start;
  while (cursor <= end && dates.length < 120) {
    dates.push(cursor);
    cursor = shiftDate(cursor, 1);
  }
  return dates;
}

export function rangeBounds(preset, anchor, customStart, customEnd) {
  if (preset === "today") return { start: anchor, end: anchor, preset };
  if (preset === "30") return { start: shiftDate(anchor, -29), end: anchor, preset };
  if (preset === "custom") {
    let start = customStart || shiftDate(anchor, -6);
    let end = customEnd || anchor;
    if (start > end) [start, end] = [end, start];
    const capped = datesInRange(start, end);
    return { start: capped[0], end: capped[capped.length - 1], preset };
  }
  return { start: shiftDate(anchor, -6), end: anchor, preset: "7" };
}

export function periodLabel(preset) {
  if (preset === "today") return "今日";
  if (preset === "30") return "近 30 天";
  if (preset === "custom") return "自訂日期";
  return "近 7 天";
}

function dayIntake(player, records, date) {
  const meals = records.filter(
    (record) =>
      record.playerId === player.id &&
      record.date === date &&
      record.status !== "draft" &&
      mealHasItems(record),
  );
  const totals = meals.reduce((sum, record) => {
    const source = record.nutritionExact || record.nutrition || empty();
    for (const key of Object.keys(sum)) sum[key] += source[key] || 0;
    return sum;
  }, empty());
  const recordedMeals = new Set(
    meals.map((record) => record.meal).filter((meal) => MAIN_MEALS.includes(meal)),
  ).size;
  const target = resolveTarget(player, player.nutritionTargets, date,
    latestDailyPlan(player.dailyPlans, player.id, date));
  return { date, totals, target, recordedMeals, hasRecord: meals.length > 0 };
}

function rate(amount, target) {
  const goal = Number(target);
  if (!Number.isFinite(goal) || goal <= 0) return null;
  return amount / goal;
}

function statusOf(row) {
  if (!row.recordedMeals || row.completeness < 60) return ["紀錄不足", "orange"];
  if ([row.calorieRate, row.proteinRate, row.carbRate, row.fatRate].some((value) => value == null))
    return ["未設定", "neutral"];
  if (row.calorieRate > 115) return ["熱量偏高", "orange"];
  if (row.calorieRate < 80) return ["熱量不足", "orange"];
  if (row.proteinRate < 80) return ["蛋白質不足", "orange"];
  if (row.carbRate < 80) return ["碳水不足", "orange"];
  if (row.fatRate > 130) return ["脂肪偏高", "orange"];
  return ["進度良好", "green"];
}

/** 各日使用當日計畫或有效的期間目標。達標日的熱量是 80%–115%，蛋白質至少 80%。 */
export function playerRange(player, records, dates) {
  const days = dates.map((date) => dayIntake(player, records, date));
  const recordedDays = days.filter((day) => day.hasRecord);
  const averageRate = (key) => {
    // 各日先除以該日目標，再取平均。沒有目標的日期不計入達成率。
    const ratios = recordedDays.map((day) => rate(day.totals[key], day.target[key]))
      .filter((value) => value != null);
    return ratios.length ? Math.round(ratios.reduce((sum, value) => sum + value, 0) / ratios.length * 100) : null;
  };
  const recordedMeals = days.reduce((sum, day) => sum + day.recordedMeals, 0);
  const expectedMeals = dates.length * MAIN_MEALS.length;
  const hitDays = recordedDays.filter((day) => {
    const calories = rate(day.totals.calories, day.target.calories);
    const protein = rate(day.totals.protein, day.target.protein);
    return calories >= 0.8 && calories <= 1.15 && protein >= 0.8;
  }).length;
  const row = {
    player,
    calorieRate: averageRate("calories"),
    proteinRate: averageRate("protein"),
    carbRate: averageRate("carbs"),
    fatRate: averageRate("fat"),
    recordedMeals,
    expectedMeals,
    completeness: expectedMeals ? Math.round((recordedMeals / expectedMeals) * 100) : 0,
    hitDays,
    dayCount: dates.length,
    completeDays: days.filter((day) => day.recordedMeals === MAIN_MEALS.length).length,
    complete: expectedMeals > 0 && recordedMeals === expectedMeals,
  };
  const [status, tone] = statusOf(row);
  return { ...row, status, tone };
}

/** 平均不含完全沒紀錄的球員。 */
export function rangeSummary(players, records, dates) {
  const rows = players.map((player) => playerRange(player, records, dates));
  const recorded = rows.filter((row) => row.recordedMeals > 0);
  const average = (key) => {
    const numbers = recorded.map((row) => row[key]).filter((value) => value != null);
    if (!numbers.length) return null;
    return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length);
  };
  return {
    rows,
    calorieRate: average("calorieRate"),
    proteinRate: average("proteinRate"),
    completePlayers: rows.filter((row) => row.complete).length,
    attentionPlayers: rows.filter((row) => row.tone === "orange" || row.tone === "red").length,
  };
}
