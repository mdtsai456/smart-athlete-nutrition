/*處理訓練日與休息日的目標範本*/

import { collection, config, request } from "./api.js";
import { assertMockWrite, csrfHeader } from "./session.js";
import { confirmedPlan } from "../services/target.service.js";

export const targetProfiles = collection("targetProfiles");

export async function listTargetProfiles(athleteId) {
  if (config.mode !== "mock") {
    const rows = await request("/target-profiles");
    return rows.filter((row) => row.athleteId === athleteId);
  }

  return (await targetProfiles.list()).filter(
    (row) => row.athleteId === athleteId,
  );
}

/**
 * 儲存某位球員的訓練日或休息日目標。
 * 同一種類型保留歷史版本，並以 startDate/endDate 控制生效期間。
 */
export async function saveTargetProfile(
  athleteId,
  trainingType,
  startDate,
  input,
  reviewed = false,
) {
  if (!["training", "rest"].includes(trainingType)) {
    throw new Error("請選擇訓練日或休息日");
  }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || "")) {
    throw new Error("請設定有效的生效日期");
    }

  const plan = confirmedPlan(input, reviewed);

  const body = {
    athleteId,
    trainingType,
    startDate,
    endDate: null,
    inputJson: plan.input,
    target: plan.target,
    reviewed: plan.reviewed,
    warnings: plan.warnings,
    confirmedAt: plan.confirmedAt,
  };

  if (config.mode !== "mock") {
    return request("/target-profiles", {
      method: "PUT",
      body,
      headers: csrfHeader(),
    });
  }

  const session = await assertMockWrite();

  if (session.role !== "nutritionist") {
    throw new Error("只有營養師可以設定營養目標");
  }

  const player = await collection("players").get(athleteId);
  if (!player) throw new Error("找不到球員");

  const store = targetProfiles;
  const rows = await store.list();

  const active = rows.filter(
    (row) =>
      row.athleteId === athleteId &&
      row.trainingType === trainingType &&
      row.startDate <= startDate &&
      (row.endDate == null || row.endDate >= startDate),
  );

  // 若生效日落在舊版本期間，先結束舊版本。
  for (const row of active) {
    const previousEnd = new Date(
      `${startDate}T00:00:00Z`,
    );
    previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);

    const endDate = previousEnd.toISOString().slice(0, 10);

    if (row.startDate >= startDate) {
      await store.remove(row.id);
    } else {
      await store.update(row.id, { endDate });
    }
  }

  return store.create({
    ...body,
    updatedAt: new Date().toISOString(),
    updatedByAccountId: session.id,
  });
}