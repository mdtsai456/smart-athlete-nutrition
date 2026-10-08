/**
 * 頁面讀取。
 * 各頁面使用相同格式的資料。
 * 此模組不寫入資料。
 */
import { accounts, athleteCoaches, coaches, nutritionists, organizations, players } from "../api/athlete.api.js";
import { collection } from "../api/api.js";
import { listDailyPlans } from "../api/plan.api.js";
import { foodNutrients, foods } from "../api/food.api.js";
import { nutritionTargets } from "../api/target.api.js";
import { today } from "../api/seed.js";
import { activeCoaches, presentAccounts, visibleAthleteIds } from "./auth.service.js";
import { presentMeal } from "./meal.service.js";
import { playerSummary, presentFood } from "./nutrition.service.js";
import { latestDailyPlan, resolveTarget } from "./target.service.js";
function average(values) {
  const numbers = values.filter((value) => value != null);
  if (!numbers.length) return null;
  return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length);
}
export { today };
async function tables() {
  const [
    playerRows,
    organizationRows,
    accountRows,
    nutritionistRows,
    coachRows,
    assignmentRows,
    foodRows,
    foodNutrientRows,
    nutrientRows,
    targetRows,
    recordRows,
    itemRows,
    snapshotRows,
    analysisRows,
    imageRows,
    dailyPlanRows,
  ] = await Promise.all([
    players.list(),
    organizations.list(),
    accounts.list(),
    nutritionists.list(),
    coaches.list(),
    athleteCoaches.list(),
    foods.list(),
    foodNutrients.list(),
    collection("nutrients").list(),
    nutritionTargets.list(),
    collection("mealRecords").list(),
    collection("mealItems").list(),
    collection("mealItemNutrients").list(),
    collection("mealAnalyses").list(),
    collection("mealImages").list(),
    listDailyPlans(),
  ]);
  return {
    players: playerRows,
    organizations: organizationRows,
    accounts: accountRows,
    nutritionists: nutritionistRows,
    coaches: coachRows,
    athleteCoaches: assignmentRows,
    foods: foodRows,
    foodNutrients: foodNutrientRows,
    nutrients: nutrientRows,
    nutritionTargets: targetRows,
    mealRecords: recordRows,
    mealItems: itemRows,
    mealItemNutrients: snapshotRows,
    mealAnalyses: analysisRows,
    mealImages: imageRows,
    dailyPlans: dailyPlanRows,
  };
}
/** 依登入者權限與指定日期篩選球員。回傳資料包含菜色、餐點與當日目標。 */
export async function loadPage(date = today, accountId = null) {
    const data = await tables();
    const directory = presentAccounts(
      data.organizations,
      data.accounts,
      data.nutritionists,
      data.coaches,
      data.players,
    );
    const account = accountId ? directory.find((item) => item.id === accountId) : null;
    const visible = new Set(visibleAthleteIds(account, data, date));
    const players = data.players.filter((player) => visible.has(player.id));
    const foods = data.foods.map((food) => presentFood(food, data.foodNutrients));
    const records = data.mealRecords
      .filter((meal) => visible.has(meal.athleteId))
      .map((meal) => ({
      ...presentMeal(meal, data),
      player: players.find((player) => player.id === meal.athleteId),
    }));
    const summaries = players.map((player) =>
      playerSummary(
        {
          ...player,
          nutritionTargets: data.nutritionTargets.filter(
            (row) => row.athleteId === player.id,
          ),
          dailyPlans: data.dailyPlans.filter((row) => row.athleteId === player.id),
          dailyPlan: latestDailyPlan(data.dailyPlans, player.id, date),
          coachName:
            activeCoaches(data.athleteCoaches, data.coaches, player.id, date).join("、") ||
            "未指派",
          target: resolveTarget(
            player,
            data.nutritionTargets,
            date,
            latestDailyPlan(data.dailyPlans, player.id, date),
          ),
        },
        records,
        date,
      ),
    );
    return {
      date,
      summary: {
        recordedPlayers: new Set(
          records
            .filter((record) => record.date === date && record.status !== "draft")
            .map((record) => record.playerId),
        ).size,
        averageRate: average(summaries.map((player) => player.rate)),
        completedPlayers: summaries.filter((player) => player.completion >= 67)
          .length,
        attentionPlayers: summaries.filter(
          (player) => player.tone === "orange" || player.tone === "red",
        ).length,
      },
      players: summaries,
      foods,
      nutrients: data.nutrients,
      records,
      directory,
      account: account ? { ...account, role: account.uiRole } : null,
      athleteId: account?.athleteId || null,
      organizationName: account?.organizationName || "男子籃球隊",
    };
}
