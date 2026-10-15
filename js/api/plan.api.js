/**
 * 每日營養計畫命令。
 * 期間營養目標與球員基本資料不使用餐點命令。
 */
import { collection, config, request } from "./api.js";
import { assertMockWrite, csrfHeader } from "./session.js";
import { confirmedPlan, latestDailyPlan } from "../services/target.service.js";

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

export async function listTargetTemplates() {
  if (config.mode !== "mock") return request("/target-templates");
  return collection("targetTemplates").list();
}

export async function listDayMarks() {
  if (config.mode !== "mock") return request("/day-marks");
  return collection("dayMarks").list();
}

/** 同一球員的訓練日或休息日只留一份範本。再次儲存會蓋掉同一組。 */
export async function saveTargetTemplate(athleteId, trainingType, input, reviewed = false) {
  if (!["training", "rest"].includes(trainingType))
    throw new Error("請選擇訓練日或休息日");
  if (config.mode !== "mock")
    return request("/target-templates", {
      method: "PUT",
      body: { athleteId, trainingType, input, warningsAcknowledged: reviewed },
      headers: csrfHeader(),
    });
  const session = await assertMockWrite();
  if (session.role !== "nutritionist") throw new Error("只有營養師可以設定營養目標");
  const player = await collection("players").get(athleteId);
  if (!player) throw new Error("找不到球員");
  const plan = confirmedPlan(
    { ...input, training: trainingType === "training" ? "訓練日" : "休息日" },
    reviewed,
  );
  const store = collection("targetTemplates");
  const current = (await store.list()).find(
    (row) => row.athleteId === athleteId && row.trainingType === trainingType,
  );
  const body = {
    athleteId,
    trainingType,
    input: plan.input,
    target: plan.target,
    updatedAt: plan.confirmedAt,
  };
  return current ? store.update(current.id, body) : store.create(body);
}

/** 只寫入這一週有排定的日子。待確認會清掉該日標記，不會改成休息日。 */
export async function saveDayMarks(athleteId, marks) {
  if (config.mode !== "mock")
    return request("/day-marks", {
      method: "PUT",
      body: { athleteId, marks },
      headers: csrfHeader(),
    });
  const session = await assertMockWrite();
  if (session.role !== "nutritionist") throw new Error("只有營養師可以設定營養目標");
  const player = await collection("players").get(athleteId);
  if (!player) throw new Error("找不到球員");
  const store = collection("dayMarks");
  const rows = await store.list();
  for (const mark of marks) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mark.localDate || ""))
      throw new Error("請設定有效的日期");
    if (!["training", "rest", "pending"].includes(mark.dayType))
      throw new Error("請選擇訓練日、休息日或待確認");
    const current = rows.find(
      (row) => row.athleteId === athleteId && row.localDate === mark.localDate,
    );
    if (mark.dayType === "pending") {
      if (current) await store.remove(current.id);
      continue;
    }
    const body = { athleteId, localDate: mark.localDate, dayType: mark.dayType };
    if (current) await store.update(current.id, body);
    else await store.create(body);
  }
}
