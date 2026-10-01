/**
 * 運動員資料規則
 * 集中生理性別與主要目標選項、基本資料欄位驗證及顯示資料整理。營養師編輯與球員自填共用相同規則。
 */
export const athleteSexes = ["男", "女", "其他", "不願透露"];
export const athleteGoals = ["維持", "增肌", "減脂", "比賽準備"];
// 新增、營養師編輯與球員自填共用白名單；不接受表單改寫 id 或營養計畫。
export function athleteProfile(data) {
  const profile = Object.fromEntries(
    [
      "name",
      "birthDate",
      "sex",
      "sport",
      "goal",
      "dietaryRestrictions",
      "allergies",
      "notes",
      "position",
    ].map((key) => [key, String(data[key] ?? "").trim()]),
  );
  if (!profile.name || !profile.sport)
    throw new Error("請填寫姓名或代號及運動項目");
  const date = new Date(profile.birthDate + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== profile.birthDate ||
    date > new Date()
  )
    throw new Error("請填寫有效且非未來的出生日期");
  if (
    !athleteSexes.includes(profile.sex) ||
    !athleteGoals.includes(profile.goal)
  )
    throw new Error("請選擇生理性別及主要目標");
  for (const [key, min, max] of [
    ["height", 50, 260],
    ["weight", 10, 350],
    ["weeklyTraining", 0, 50],
  ]) {
    const value = Number(data[key]);
    if (
      data[key] == null ||
      String(data[key]).trim() === "" ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (key === "weeklyTraining" && !Number.isInteger(value))
    )
      throw new Error("請檢查身高、體重及每週訓練次數");
    profile[key] = value;
  }
  profile.bodyFat =
    data.bodyFat == null || String(data.bodyFat).trim() === ""
      ? null
      : Number(data.bodyFat);
  if (
    profile.bodyFat !== null &&
    (!Number.isFinite(profile.bodyFat) ||
      profile.bodyFat <= 0 ||
      profile.bodyFat >= 100)
  )
    throw new Error("體脂率須介於 0 與 100% 之間，或留白");
  profile.number =
    data.number == null || String(data.number).trim() === ""
      ? ""
      : Number(data.number);
  if (
    profile.number !== "" &&
    (!Number.isInteger(profile.number) ||
      profile.number < 0 ||
      profile.number > 99)
  )
    throw new Error("背號須為 0–99，或留白");
  return profile;
}
export function athleteFacts(player) {
  return [
    ["出生日期", player.birthDate || "未填寫"],
    ["生理性別", player.sex || "未填寫"],
    ["身高", player.height ? `${player.height} cm` : "未填寫"],
    ["體重", player.weight ? `${player.weight} kg` : "未填寫"],
    ["體脂率", player.bodyFat == null ? "未填寫" : `${player.bodyFat}%`],
    ["運動項目", player.sport || "未填寫"],
    [
      "每週訓練",
      player.weeklyTraining == null ? "未填寫" : `${player.weeklyTraining} 次`,
    ],
    ["主要目標", player.goal || "未填寫"],
    ["飲食限制", player.dietaryRestrictions || "未填寫"],
    ["過敏", player.allergies || "未填寫"],
    ["備註", player.notes || "未填寫"],
  ];
}
