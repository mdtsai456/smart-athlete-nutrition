/**
 * 運動員共用元件
 * 產生完整資料、編輯表單及精簡摘要卡，供球員、營養師與教練頁面重用。欄位規則與資料整理來自 athlete Service。
 */
import { esc, avatar } from "./ui.js";
import {
  athleteFacts,
  athleteGoals,
  athleteSexes,
} from "../services/athlete.js";
export function athleteDetails(player, compact = false) {
  const facts = athleteFacts(player);
  const selected = compact
    ? facts.filter(([label]) =>
        [
          "體重",
          "運動項目",
          "每週訓練",
          "主要目標",
          "飲食限制",
          "過敏",
          "備註",
        ].includes(label),
      )
    : facts;
  return `<dl class="athlete-facts">${selected.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>`;
}
export function athleteForm(player = {}) {
  const field = (label, name, type = "text", extra = "", required = true) =>
    `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(player[name] ?? "")}" ${extra} ${required ? "required" : ""}></label>`;
  const select = (label, name, options) =>
    `<label class="field">${label}<select name="${name}" required><option value="">請選擇</option>${options.map((value) => `<option ${player[name] === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>`;
  return `<input name="playerId" type="hidden" value="${esc(player.id || "")}"><div class="form-grid">${field("姓名或代號", "name")}${field("出生日期", "birthDate", "date")}${select("生理性別", "sex", athleteSexes)}${field("身高（cm）", "height", "number", 'min="50" max="260" step="0.1"')}${field("體重（kg）", "weight", "number", 'min="10" max="350" step="0.1"')}${field("體脂率（%・選填）", "bodyFat", "number", 'min="0.1" max="99.9" step="0.1"', false)}${field("運動項目", "sport")}${field("每週訓練次數", "weeklyTraining", "number", 'min="0" max="50" step="1"')}${select("主要目標", "goal", athleteGoals)}${field("背號（選填）", "number", "number", 'min="0" max="99"', false)}${field("位置（選填）", "position", "text", "", false)}</div>${[
    ["dietaryRestrictions", "飲食限制"],
    ["allergies", "過敏"],
    ["notes", "備註"],
  ]
    .map(
      ([key, label]) =>
        `<label class="field">${label}<textarea name="${key}" rows="2" placeholder="無則填寫「無」，尚未確認可留白">${esc(player[key] || "")}</textarea></label>`,
    )
    .join("")}`;
}

export function athleteSummary(player) {
  const facts = athleteFacts(player);
  const metrics = facts.filter(([label]) =>
    ["體重", "運動項目", "每週訓練", "主要目標"].includes(label),
  );
  const notices = facts.filter(([label]) =>
    ["飲食限制", "過敏"].includes(label),
  );
  return `<section class="athlete-summary" aria-label="運動員摘要"><div class="athlete-summary-head"><div class="athlete-identity">${avatar(player)}<div><span class="athlete-eyebrow">正在規劃的運動員</span><h2>${esc(player.name)} <small>${player.number === "" || player.number == null ? "" : `#${esc(player.number)}`}</small></h2></div></div><button type="button" class="btn profile-edit" data-action="edit-player" data-id="${esc(player.id)}">編輯資料 <span aria-hidden="true">↗</span></button></div><dl class="athlete-metrics">${metrics.map(([label, value]) => `<div><dt>${label}</dt><dd class="${value === "未填寫" ? "is-missing" : ""}">${esc(value)}</dd></div>`).join("")}</dl><div class="athlete-notices">${notices.map(([label, value]) => `<div class="athlete-notice ${label === "過敏" && value !== "無" && value !== "未填寫" ? "has-allergy" : ""}"><span class="notice-dot" aria-hidden="true"></span><strong>${label}</strong><span>${esc(value === "未填寫" ? "待確認" : value)}</span></div>`).join("")}<details class="athlete-note"><summary>查看備註 <span aria-hidden="true">＋</span></summary><p>${esc(player.notes || "尚未填寫備註")}</p></details></div></section>`;
}
