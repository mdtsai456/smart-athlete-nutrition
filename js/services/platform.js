import { athleteProfile } from "./athlete.js";
import { confirmedPlan } from "./planner.js";
import { request } from "../api/client.js";
import { today } from "../api/seed.js";
import { playerSummary, roundedNutrition } from "./nutrition.js";
export { today };
export const roles = { nutritionist: "營養師", coach: "教練", player: "球員" };
export const platform = {
  // 角色頁面共用這份資料；每日計畫優先於球員的預設營養目標。
  async load(date = today) {
    const [players, foods, records] = await Promise.all(
      ["players", "foods", "records"].map((x) => request("/" + x)),
    );
    const summaries = players.map((p) =>
      playerSummary(
        { ...p, target: p.nutritionPlans?.[date]?.target || p.target },
        records,
        foods,
        date,
      ),
    );
    return {
      date,
      summary: {
        recordedPlayers: new Set(
          records
            .filter((record) => record.date === date)
            .map((record) => record.playerId),
        ).size,
        averageRate:
          Math.round(
            summaries.reduce((sum, player) => sum + player.rate, 0) /
              summaries.length,
          ) || 0,
        completedPlayers: summaries.filter((player) => player.completion >= 67)
          .length,
        attentionPlayers: summaries.filter((player) => player.tone !== "green")
          .length,
      },
      players: summaries,
      foods,
      records: records.map((r) => ({
        ...r,
        player: players.find((p) => p.id === r.playerId),
        nutrition: roundedNutrition(r.items, foods),
        foodNames: r.items
          .map((i) => foods.find((f) => f.id === i.foodId)?.name)
          .join("、"),
      })),
    };
  },
  async addPlayer(data) {
    const profile = athleteProfile(data);
    return request("/players", {
      method: "POST",
      body: {
        ...profile,
        team: "男子籃球隊",
        target: { calories: 2800, protein: 150, carbs: 374.5, fat: 78 },
      },
    });
  },
  async updateMyProfile(data) {
    // Demo session represents p1; adapt to authenticated /me in the real service.
    return this.updatePlayer("p1", data);
  },
  async updatePlayer(id, data) {
    const profile = athleteProfile(data);
    return request("/players/" + id, { method: "PATCH", body: profile });
  },
  async addFood(data) {
    return request("/foods", {
      method: "POST",
      body: { ...data, emoji: "🥗" },
    });
  },
  // 只合併指定日期，保留其他日期及球員基本資料。
  async saveNutritionPlan(id, date, input, reviewed = false) {
    const plan = confirmedPlan(input, reviewed);
    const player = await request("/players/" + id);
    if (!player) throw new Error("找不到球員");
    return request("/players/" + id, {
      method: "PATCH",
      body: { nutritionPlans: { ...player.nutritionPlans, [date]: plan } },
    });
  },
  async addRecord(data) {
    const foods = await request("/foods");
    validateMealItems(data.items, foods);
    return request("/records", {
      method: "POST",
      body: {
        ...data,
        time: new Date().toLocaleTimeString("zh-TW", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        source: data.source || "手動記錄",
      },
    });
  },
  async previewNutrition(items) {
    const foods = await request("/foods");
    validateMealItems(items, foods);
    return roundedNutrition(items, foods);
  },
  async recognizeMeal(context) {
    const result = await request("/camera/recognitions", {
      method: "POST",
      body: context,
    });
    const foods = await request("/foods");
    validateMealItems(result.items, foods);
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        name: foods.find((food) => food.id === item.foodId).name,
      })),
      nutrition: roundedNutrition(result.items, foods),
    };
  },
};
// 未建檔食物不能當作零營養，缺少重量也不能產生正式飲食紀錄。
function validateMealItems(items, foods) {
  if (
    !Array.isArray(items) ||
    !items.length ||
    items.some(
      (item) =>
        !Number.isFinite(item.grams) || item.grams <= 0 || item.grams > 3000,
    )
  )
    throw new Error("缺少有效食物重量，請重新拍攝或請營養師確認。");
  if (items.some((item) => !foods.some((food) => food.id === item.foodId)))
    throw new Error("辨識食物尚未對應營養資料表，請營養師建檔後再記錄。");
}
