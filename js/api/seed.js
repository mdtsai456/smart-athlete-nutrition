/**
 * Mock 初始資料。
 * 食物、營養素、餐點與營養資料分開存放。
 * 球員的 target 只在沒有生效目標時作為基準。
 * target 不是當日攝取。
 */
export const today = "2026-11-16";
const FOOD_ROWS = [
  ["f1", "香煎雞胸肉", "蛋白質", "🍗", 165, 31, 0, 3.6],
  ["f2", "糙米飯", "全穀雜糧", "🍚", 111, 2.6, 23, 0.9],
  ["f3", "清炒花椰菜", "蔬菜", "🥦", 45, 3.7, 5, 1.5],
  ["f4", "水煮蛋", "蛋白質", "🥚", 155, 13, 1.1, 11],
  ["f5", "烤鮭魚", "蛋白質", "🐟", 208, 20, 0, 13],
  ["f6", "烤地瓜", "全穀雜糧", "🍠", 115, 1.3, 27, 0.2],
];
export const nutrients = [
  { id: "energy", nutrientCode: "ENERC", name: "熱量", unit: "kcal", status: "active" },
  { id: "protein", nutrientCode: "PROT", name: "蛋白質", unit: "g", status: "active" },
  { id: "carbohydrate", nutrientCode: "CHO", name: "碳水化合物", unit: "g", status: "active" },
  { id: "fat", nutrientCode: "FAT", name: "脂肪", unit: "g", status: "active" },
];
function snapshotAmount(per100g, grams) {
  return Math.round(((per100g * grams) / 100) * 10000) / 10000;
}
function buildCatalog() {
  const foods = [];
  const foodNutrients = [];
  for (const [id, name, foodType, emoji, energy, protein, carbohydrate, fat] of FOOD_ROWS) {
    foods.push({ id, name, foodType, emoji, status: "active" });
    for (const [nutrientId, amountPer100g] of [
      ["energy", energy],
      ["protein", protein],
      ["carbohydrate", carbohydrate],
      ["fat", fat],
    ]) {
      foodNutrients.push({
        id: `fn-${id}-${nutrientId}`,
        foodId: id,
        nutrientId,
        amountPer100g,
      });
    }
  }
  return { foods, foodNutrients };
}
/** 示範餐的營養資料在建立時就算好，不跟著之後的食物表變。 */
function buildMeals(foodNutrients) {
  const mealRecords = [];
  const mealItems = [];
  const mealItemNutrients = [];
  const mealImages = [];
  const mealAnalyses = [];
  const addMeal = (id, athleteId, mealType, time, lines, mode, date = today) => {
    const consumedAt = new Date(`${date}T${time}:00+08:00`).toISOString();
    mealRecords.push({
      id,
      athleteId,
      consumedAt,
      localDate: date,
      timezone: "Asia/Taipei",
      mealType,
      note: null,
      status: "reviewed",
      createdByAccountId: `player:${athleteId}`,
      statusChangedByAccountId: "nutritionist",
      statusChangedAt: consumedAt,
      statusChangeReason: null,
      createdAt: consumedAt,
      updatedAt: consumedAt,
    });
    if (mode === "ai") {
      mealImages.push({
        id: `img-${id}`,
        mealRecordId: id,
        objectKey: `meals/${id}/plate.jpg`,
        mimeType: "image/jpeg",
        uploadedAt: consumedAt,
      });
      mealAnalyses.push({
        id: `an-${id}`,
        mealRecordId: id,
        modelName: "食物攝影機（模擬）",
        modelVersion: "mock-1",
        status: "succeeded",
        rawResultJson: { items: lines },
        errorMessage: null,
        startedAt: consumedAt,
        completedAt: consumedAt,
        createdAt: consumedAt,
      });
    }
    lines.forEach(([foodId, grams], index) => {
      const itemId = `${id}-i${index}`;
      const rows = foodNutrients.filter((row) => row.foodId === foodId);
      mealItems.push({
        id: itemId,
        mealRecordId: id,
        mealAnalysisId: mode === "ai" ? `an-${id}` : null,
        foodId,
        detectedLabel: null,
        estimatedWeightG: grams,
        confirmedWeightG: grams,
        weightSource: mode === "ai" ? "ai" : "manual",
        confirmationStatus: "confirmed",
        snapshotNutrientCount: rows.length,
        confirmedByAccountId: mode === "ai" ? `player:${athleteId}` : "nutritionist",
        confirmedAt: consumedAt,
        createdAt: consumedAt,
        updatedAt: consumedAt,
      });
      for (const row of rows) {
        mealItemNutrients.push({
          id: `snap-${itemId}-${row.nutrientId}`,
          mealItemId: itemId,
          nutrientId: row.nutrientId,
          amount: snapshotAmount(row.amountPer100g, grams),
          calculatedAt: consumedAt,
        });
      }
    });
  };
  for (let i = 0; i < 8; i += 1)
    addMeal(`mb${i}`, `p${i + 1}`, "breakfast", "08:15", [
      ["f4", 100],
      ["f6", 200],
    ], "manual");
  for (let i = 0; i < 6; i += 1)
    addMeal(`ml${i}`, `p${i + 1}`, "lunch", `12:${String(10 + i * 3).padStart(2, "0")}`, [
      ["f1", 180],
      ["f2", 250],
      ["f3", 150],
    ], "ai");
  for (let offset = 1; offset <= 6; offset += 1) {
    const date = new Date(Date.UTC(2026, 10, 16 - offset)).toISOString().slice(0, 10);
    for (let i = 0; i < 8; i += 1) {
      const sparse = i >= 6;
      if (sparse && offset % 2 === 0) continue;
      const rice = [140, 150, 420, 230, 250, 180, 90, 80][i];
      const chicken = [150, 160, 280, 180, 190, 140, 90, 80][i];
      addMeal(
        `hx-b-${offset}-${i}`,
        `p${i + 1}`,
        "breakfast",
        "08:10",
        [
          ["f4", 100],
          ["f6", i === 2 ? 260 : 150],
        ],
        "manual",
        date,
      );
      if (!sparse || offset % 3 !== 0)
        addMeal(
          `hx-l-${offset}-${i}`,
          `p${i + 1}`,
          "lunch",
          "12:20",
          [
            ["f1", chicken],
            ["f2", rice],
            ["f3", 120],
          ],
          "manual",
          date,
        );
      if (i < 5)
        addMeal(
          `hx-d-${offset}-${i}`,
          `p${i + 1}`,
          "dinner",
          "18:40",
          [
            ["f5", i === 2 ? 220 : 140],
            ["f2", rice],
          ],
          "manual",
          date,
        );
    }
  }
  return { mealRecords, mealItems, mealItemNutrients, mealImages, mealAnalyses };
}
const { foods, foodNutrients } = buildCatalog();
const meals = buildMeals(foodNutrients);
export const seed = {
  players: [
    "陳柏宇",
    "林冠廷",
    "王子豪",
    "張祐誠",
    "黃品睿",
    "李承恩",
    "吳俊傑",
    "劉宇翔",
  ].map((name, i) => ({
    id: `p${i + 1}`,
    name,
    birthDate: `2002-05-${String(i + 10).padStart(2, "0")}`,
    sex: "男",
    bodyFat: i === 0 ? 14 : null,
    sport: "籃球",
    weeklyTraining: 5,
    goal: ["維持", "增肌", "比賽準備"][i % 3],
    dietaryRestrictions: "無",
    allergies: i === 0 ? "花生" : "無",
    notes: "示範資料，請依實際情況更新",
    number: [7, 12, 23, 9, 11, 3, 15, 21][i],
    position: ["控球後衛", "小前鋒", "中鋒", "得分後衛", "大前鋒"][i % 5],
    accountId: `acct-p${i + 1}`,
    team: "男子籃球隊",
    height: 178 + i * 3,
    weight: 72 + i * 3,
    target: { calories: 2800, protein: 150, carbs: 374.5, fat: 78 },
  })),
  organizations: [
    { id: "org1", name: "男子籃球隊", status: "active" },
    { id: "org2", name: "停用球團", status: "inactive" },
  ],
  accounts: [
    {
      id: "acct-n1",
      organizationId: "org1",
      email: "lin.yian@example.com",
      passwordHash: "demo",
      role: "nutritionist",
      status: "active",
    },
    {
      id: "acct-c1",
      organizationId: "org1",
      email: "lin.zhiyuan@example.com",
      passwordHash: "demo",
      role: "coach",
      status: "active",
    },
    {
      id: "acct-c-suspended",
      organizationId: "org1",
      email: "suspended.coach@example.com",
      passwordHash: "demo",
      role: "coach",
      status: "suspended",
    },
    {
      id: "acct-c-org2",
      organizationId: "org2",
      email: "other.coach@example.com",
      passwordHash: "demo",
      role: "coach",
      status: "active",
    },
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
      id: `acct-p${n}`,
      organizationId: "org1",
      email: `player${n}@example.com`,
      passwordHash: "demo",
      role: "athlete",
      status: "active",
    })),
  ],
  nutritionists: [{ id: "n1", accountId: "acct-n1", name: "林怡安" }],
  coaches: [
    { id: "c1", accountId: "acct-c1", name: "林志遠" },
    { id: "c-suspended", accountId: "acct-c-suspended", name: "停權教練" },
    { id: "c-org2", accountId: "acct-c-org2", name: "外隊教練" },
  ],
  athleteCoaches: [
    ["p1", "2026-01-01", null],
    ["p2", "2026-01-01", "2026-10-31"],
    ["p3", "2026-12-01", null],
    ["p4", "2026-01-01", null],
    ["p5", "2026-01-01", null],
    ["p6", "2026-01-01", null],
    ["p7", "2026-01-01", null],
    ["p8", "2026-01-01", null],
  ].map(([athleteId, startDate, endDate]) => ({
    id: `ac-${athleteId}`,
    athleteId,
    coachId: "c1",
    startDate,
    endDate,
  })),
  nutrients,
  foods,
  foodNutrients,
  nutritionTargets: [],
  targetProfiles: [],
  ...meals,
};
