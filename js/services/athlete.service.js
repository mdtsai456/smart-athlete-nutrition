/**
 * 運動員欄位規則。
 * 營養師編輯與球員自填使用相同白名單。
 * 表單不能改 id 或營養計畫。
 */
import { accounts, players } from "../api/athlete.api.js";
export const athleteSexes = ["男", "女", "其他", "不願透露"];
export const athleteGoals = ["維持", "增肌", "減脂", "比賽準備"];
// 【表單錯誤定位】新增：丟出帶 fields 的錯誤。message 給底部摘要，fields（欄位名→原因）給欄位旁顯示
const fail = (message, fields) => Object.assign(new Error(message), { fields });
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
    // 【表單錯誤定位】修改：改用 fail()，指出是姓名還是運動項目
    throw fail("請填寫姓名或代號及運動項目", {
      ...(!profile.name && { name: "請輸入姓名或代號" }),
      ...(!profile.sport && { sport: "請輸入運動項目" }),
    });
  const date = new Date(profile.birthDate + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== profile.birthDate ||
    date > new Date()
  )
    // 【表單錯誤定位】修改：改用 fail()
    throw fail("請填寫有效且非未來的出生日期", {
      birthDate: "請填寫有效且不晚於今天的出生日期",
    });
  if (
    !athleteSexes.includes(profile.sex) ||
    !athleteGoals.includes(profile.goal)
  )
    // 【表單錯誤定位】修改：改用 fail()，分別指出性別或目標
    throw fail("請選擇生理性別及主要目標", {
      ...(!athleteSexes.includes(profile.sex) && { sex: "請選擇生理性別" }),
      ...(!athleteGoals.includes(profile.goal) && { goal: "請選擇主要目標" }),
    });
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
      // 【表單錯誤定位】修改：改用 fail()，用 [key] 指出是身高、體重或每週訓練次數
      throw fail("請檢查身高、體重及每週訓練次數", {
        [key]:
          key === "weeklyTraining"
            ? `每週訓練次數須為 ${min}–${max} 的整數`
            : `${key === "height" ? "身高" : "體重"}須介於 ${min}–${max}`,
      });
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
    // 【表單錯誤定位】修改：改用 fail()
    throw fail("體脂率須介於 0 與 100% 之間，或留白", {
      bodyFat: "體脂率須介於 0 與 100% 之間，或留白",
    });
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
    // 【表單錯誤定位】修改：改用 fail()
    throw fail("背號須為 0–99，或留白", {
      number: "背號須為 0–99 的整數，或留白",
    });
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
export async function addPlayer(data, organizationId = "org1") {
  const profile = athleteProfile(data);
  const account = await accounts.create({
    organizationId,
    email: `athlete-${crypto.randomUUID()}@example.com`,
    passwordHash: "demo",
    role: "athlete",
    status: "active",
  });
  return players.create({
    ...profile,
    accountId: account.id,
    team: "男子籃球隊",
    target: { calories: 2800, protein: 150, carbs: 374.5, fat: 78 },
  });
}
export async function updatePlayer(id, data) {
  return players.update(id, athleteProfile(data));
}
export async function updateMyProfile(data, accountId = "acct-p1") {
  const player = (await players.list()).find((item) => item.accountId === accountId);
  if (!player) throw new Error("找不到球員");
  return updatePlayer(player.id, data);
}