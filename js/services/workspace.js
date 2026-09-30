export function playerDaily(data, playerId = "p1") {
  const player = data.players.find((player) => player.id === playerId);
  const records = data.records.filter(
    (record) => record.date === data.date && record.playerId === playerId,
  );
  const meals = ["早餐", "午餐", "晚餐"].map((meal) => {
    const actual = records.filter((record) => record.meal === meal);
    return {
      meal,
      actual: actual.map((record) => record.foodNames).join("；"),
      recorded: actual.length > 0,
    };
  });
  return {
    player,
    meals,
    recordedCount: meals.filter((meal) => meal.recorded).length,
    proteinRate: Math.round(
      (player.totals.protein / player.target.protein) * 100,
    ),
  };
}
