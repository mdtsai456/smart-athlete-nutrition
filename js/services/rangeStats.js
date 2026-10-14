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

/** 前半與後半的平均熱量差 8% 以上才標上升或下降。 */
function trendOf(recordedDays) {
  if (recordedDays.length < 2) return "flat";
  const mid = Math.ceil(recordedDays.length / 2);
  const average = (days) =>
    days.reduce((sum, day) => sum + day.totals.calories, 0) / days.length;
  const early = average(recordedDays.slice(0, mid));
  const late = average(recordedDays.slice(mid));
  if (!early) return late ? "up" : "flat";
  const delta = (late - early) / early;
  if (delta >= 0.08) return "up";
  if (delta <= -0.08) return "down";
  return "flat";
}

function statusOf(row) {
  //把回傳的狀態改成陣列，即可同時顯示多個狀態
  const alerts_array = [];

  //合併檢查：如果四個指標全部都沒有資料 (皆為 null)，直接合併回傳一項即可
  if (
    [row.calorieRate, row.proteinRate, row.carbRate, row.fatRate].every(
      (value) => value == null
    )
  ) {
    return [
      {
        nutrient: "all",
        label: "皆未設定目標",
        tone: "neutral",
      },
    ];
  }

  //有那些需要檢查的項目熱量、蛋白質等
  const checks = [
    {
      key: "calorieRate",label: "熱量",low: 80,high: 115,unit: "%",},
    {key: "proteinRate",label: "蛋白質",low: 80,high: null,unit: "%",},
    {key: "carbRate",label: "碳水",low: 80,high: null,unit: "%",},
    {key: "fatRate",label: "脂肪",low: null,high: 130,unit: "%",},
  ];

    for (const item of checks) {
    const rate = row[item.key];

    if (rate == null) {
      alerts_array.push({
        nutrient: item.key,
        label: `${item.label}未設定目標`,
        tone: "neutral",
      });
      continue;
    }

    if (item.low != null && rate < item.low) {
      alerts_array.push({
        nutrient: item.key,
        label: `${item.label}不足`,
        tone: "orange",
      });
    } else if (item.high != null && rate > item.high) {
      alerts_array.push({
        nutrient: item.key,
        label: `${item.label}偏高`,
        tone: "orange",
      });
    } else{
      alerts_array.push({
        nutrient: item.key,
        label: `${item.label}符合設定範圍`,
        tone: "green",
      });
    }
  }

  return alerts_array;
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
    trend: trendOf(recordedDays),
    complete: expectedMeals > 0 && recordedMeals === expectedMeals,
  };
  const alerts = statusOf(row);
  return { ...row, alerts }; // 將完整的物件陣列傳給前端
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
    attentionPlayers: rows.filter((row) => 
      row.alerts.some((alert) => alert.tone === "orange" || alert.tone === "red")
    ).length,
  };
}
