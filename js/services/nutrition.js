// 資料庫的營養值以每 100 g 儲存；先按重量加總，顯示時才取整數。
export function nutrition(items, foods) {
  return items.reduce(
    (sum, item) => {
      const food = foods.find((f) => f.id === item.foodId);
      if (!food) return sum;
      for (const k of Object.keys(sum)) sum[k] += (food[k] * item.grams) / 100;
      return sum;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
export function roundedNutrition(items, foods) {
  return Object.fromEntries(
    Object.entries(nutrition(items, foods)).map(([k, v]) => [k, Math.round(v)]),
  );
}
export function playerSummary(player, records, foods, date) {
  const meals = records.filter(
    (r) => r.playerId === player.id && r.date === date,
  );
  const totals = roundedNutrition(
    meals.flatMap((r) => r.items),
    foods,
  );
  const rate = Math.round((totals.calories / player.target.calories) * 100);
  return {
    ...player,
    totals,
    rate,
    completion: Math.round(
      (new Set(
        meals
          .map((r) => r.meal)
          .filter((meal) => ["早餐", "午餐", "晚餐"].includes(meal)),
      ).size /
        3) *
        100,
    ),
    status: rate < 60 ? "待關注" : rate > 110 ? "攝取偏高" : "進度良好",
    tone: rate < 60 ? "orange" : rate > 110 ? "red" : "green",
  };
}
