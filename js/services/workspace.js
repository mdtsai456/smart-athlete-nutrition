/**
 * 角色首頁資料整理
 * 將平台資料整理成指定球員的每日三餐紀錄、已記錄餐次與蛋白質達成率，供球員首頁及教練頁使用。
 */
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
