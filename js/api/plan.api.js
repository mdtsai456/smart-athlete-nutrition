/**
 * 每日營養計畫命令。
 * 期間一段日期內的營養目標 與 球員本人的基本資料不使用餐點命令。
 */
import { collection, config, request } from "./api.js";
import { assertMockWrite, csrfHeader } from "./session.js";
import { confirmedPlan, latestDailyPlan } from "../services/target.service.js";


/**
 * 儲存球員每週每日的日別設定（訓練日、休息日或未設定）
 * @param {string} athleteId 
 * @param {string} weekId 
 * @param {Object} dailyTypes - 格式如 { "2026-10-12": "training", "2026-10-13": "rest", "2026-10-14": "unconfirmed" }
 */
export function saveWeeklyPlanDays(athleteId, weekId, dailyTypes) {
    // 尚未設定的日別顯示「待確認」，不自動當成休息日
    localStorage.setItem(`weekly_plan_${athleteId}_${weekId}`, JSON.stringify(dailyTypes));
}

/**
 * 儲存單日目標調整（同一天再次儲存會新增版本）
 * @param {string} athleteId 
 * @param {string} date 
 * @param {Object} targetData 
 */
export function saveSingleDayPlanVersion(athleteId, date, targetData) {
    const key = `day_versions_${athleteId}_${date}`;
    const history = JSON.parse(localStorage.getItem(key) || '[]');
    
    const newVersion = {
        ...targetData,
        version: history.length + 1,
        updatedAt: new Date().toISOString(),
        isCustomized: true // 標示該日已個別調整
    };

    history.push(newVersion);
    localStorage.setItem(key, JSON.stringify(history));
}

/**
 * 讀取指定日期的最新計畫版本
 */
export function getLatestDayPlan(athleteId, date) {
    const key = `day_versions_${athleteId}_${date}`;
    const history = JSON.parse(localStorage.getItem(key) || '[]');
    if (history.length === 0) return null;
    return history[history.length - 1]; // 讀取時使用最新版本
}

export async function saveDailyPlan(body) {
  if (config.mode !== "mock")
    return request("/daily-plans", { method: "PUT", body, headers: csrfHeader() });
  const session = await assertMockWrite();
  if (session.role !== "nutritionist") throw new Error("只有營養師可以儲存每日計畫");
  const plan = confirmedPlan(body.input, body.warningsAcknowledged);
  const store = collection("dailyPlans");
  const current = latestDailyPlan(await store.list(), body.athleteId, body.localDate);
  const currentRevision = current?.revision ?? 0;
  if (body.expectedRevision != null && Number(body.expectedRevision) !== currentRevision) {
    const error = new Error("每日計畫已被其他人更新，請重新讀取");
    error.status = 409;
    throw error;
  }
  const player = await collection("players").get(body.athleteId);
  if (!player) throw new Error("找不到球員");
  return store.create({
    athleteId: body.athleteId,
    localDate: body.localDate,
    revision: currentRevision + 1,
    inputJson: plan.input,
    target: plan.target,
    warningsAcknowledged: !!body.warningsAcknowledged,
    warningsJson: plan.warnings,
    confirmedAt: plan.confirmedAt,
    confirmedByAccountId: session.id,
    reason: body.reason || null,
  });
}

export function saveNutritionPlan(id, date, input, reviewed = false, expectedRevision) {
  return saveDailyPlan({
    athleteId: id,
    localDate: date,
    expectedRevision,
    input,
    warningsAcknowledged: reviewed,
    reason: null,
  });
}
export async function listDailyPlans() {
  if (config.mode !== "mock") return request("/daily-plans");
  return collection("dailyPlans").list();
}
