/**
 * 營養分析頁。
 * 時間區段切換達成表，右上角長條圖用同一區段的熱量達成率。
 */
import { avatar, badge, empty, esc, percent } from "../../components/ui.js";
import { datesInRange, rangeBounds, rangeSummary } from "../../services/rangeStats.js";

const STATUS_MARK = { ok: "✓", high: "↑", low: "↓", unset: "—" };
const STATUS_WORD = { ok: "符合", high: "過高", low: "過低", unset: "未設定" };

function statusBadge(alert) {
  if (alert.nutrient === "all") return badge(alert.label, alert.tone);
  const mark = STATUS_MARK[alert.level] || "";
  const word = STATUS_WORD[alert.level] || "";
  return `<span class="badge ${alert.tone}" aria-label="${esc(`${alert.label}${word}`)}"><span class="status-mark" aria-hidden="true">${mark}</span>${esc(alert.label)}</span>`;
}

function rangeTable(rows) {
  if (!rows.length) return empty("這個區段沒有可查看的球員");
  return `<div class="table-wrap"><table class="range-table"><thead><tr><th>球員</th><th>紀錄完整率</th><th>熱量</th><th>蛋白質</th><th>碳水</th><th>脂肪</th><th>達標天數</th><th>狀態</th></tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr><td><div class="person">${avatar(row.player)}<div><strong>${esc(row.player.name)} #${row.player.number}</strong><small>${esc(row.player.sport || "籃球")} · ${esc(row.player.position || "")}</small></div></div></td><td><strong>${percent(row.completeness)}</strong><small>${row.recordedMeals} / ${row.expectedMeals}</small></td><td>${percent(row.calorieRate)}</td><td>${percent(row.proteinRate)}</td><td>${percent(row.carbRate)}</td><td>${percent(row.fatRate)}</td><td>${row.hitDays} / ${row.dayCount}</td><td>${row.alerts.map((alert) => statusBadge(alert)).join(" ")}</td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function calorieTone(row) {
  const level = row.alerts?.find((alert) => alert.nutrient === "calorieRate")?.level;
  if (level === "high") return "red";
  if (level === "low") return "yellow";
  if (level === "ok") return "green";
  return "is-unset";
}

function compactChart(rows) {
  if (!rows.length) return "";
  return `<section class="panel chart-panel range-chart"><div class="panel-heading"><div><h2>熱量達成率</h2><p>有紀錄日期的平均</p></div></div><div class="bar-chart"><div class="axis"><span>100%</span><span>50%</span><span>0%</span></div><div class="bars">${rows
    .map((row) => {
      const value = row.calorieRate;
      const height = value == null ? 0 : Math.min(100, value);
      return `<div class="bar-column"><div class="bar-track"><div class="chart-bar ${calorieTone(row)}" style="height:${height}%"><span>${percent(value)}</span></div></div><small>${esc(row.player.name)}</small></div>`;
    })
    .join("")}</div></div></section>`;
}

export function rangeBoard(data, players, state, options = {}) {
  const bounds = rangeBounds(state.rangePreset || "7", data.date, state.rangeStart, state.rangeEnd);
  const summary = rangeSummary(players, data.records, datesInRange(bounds.start, bounds.end));
  const choices = [
    ["today", "今日"],
    ["7", "近 7 天"],
    ["30", "近 30 天"],
    ["custom", "自訂日期"],
  ];
  const controls = `<div class="range-controls"><p class="range-lead">切換時間區段，看平均達成率、達標天數、紀錄完整率和異常原因。</p><div class="range-switch" role="tablist">${choices
    .map(
      ([id, label]) =>
        `<button type="button" class="range-pill ${bounds.preset === id ? "active" : ""}" data-action="range" data-id="${id}" role="tab" aria-selected="${bounds.preset === id}">${label}</button>`,
    )
    .join(
      "",
    )}</div><div class="range-fields"><label>開始<input type="date" id="range-start" aria-label="開始日期" value="${esc(bounds.start)}"></label><label>結束<input type="date" id="range-end" aria-label="結束日期" value="${esc(bounds.end)}"></label></div></div>`;
  const chart = options.chart ? compactChart(summary.rows) : "";
  const table = options.table === false
    ? ""
    : `<section class="panel"><div class="panel-heading"><div><h2>球員營養達成狀況</h2><p>狀態符號：✓ 是符合，↑ 是過高，↓ 是過低。熱量以 80%–115% 為符合。蛋白質與碳水低於 80% 為過低。脂肪高於 130% 為過高。— 表示該項沒有目標。</p></div></div>${rangeTable(summary.rows)}</section>`;

  return `<section class="range-board">${chart ? `<div class="range-top">${controls}${chart}</div>` : controls}${table}</section>`;
}

/** 營養師與教練看全隊。右上角長條圖跟著同一個時間區段。 */
export function analysisView(data, role, state = {}) {
  const self = data.players.find((player) => player.id === (data.athleteId || "p1")) || data.players[0];
  const players = role === "player" ? (self ? [self] : []) : data.players;
  return rangeBoard(data, players, state, { chart: role !== "player" });
}
