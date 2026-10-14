/**
 * 營養分析頁。
 * 上方顯示時間區段統計。
 * 營養師與教練頁面的下方顯示當日達成概況。
 */
import { avatar, badge, empty, esc, icon, percent, playerTable } from "../../components/ui.js";
import { datesInRange, periodLabel, rangeBounds, rangeSummary } from "../../services/rangeStats.js";
const TREND = { up: "↑", down: "↓", flat: "→" };

function rangeCards(summary, label, solo) {
  const self = summary.rows[0];
  const isSingleDay = (self ? self.dayCount : 0) === 1;
  const ratePrefix = isSingleDay ? "當日" : "平均";
  const cards = solo
    ? [
        [`${ratePrefix}熱量達成率`, percent(summary.calorieRate)],
        [`${ratePrefix}蛋白質達成率`, percent(summary.proteinRate)],
        ["完整紀錄天數", `${self?.completeDays ?? 0} / ${self?.dayCount ?? 0}`],
        ["需要關注", `${self ? self.dayCount - self.hitDays : 0}`],
      ]
    : [
        [`${ratePrefix}熱量達成率`, percent(summary.calorieRate)],
        [`${ratePrefix}蛋白質達成率`, percent(summary.proteinRate)],
        ["完整紀錄球員", `${summary.completePlayers} / ${summary.rows.length}`],
        ["需要關注", `${summary.attentionPlayers}`],
      ];
  const feet = solo
    ? [label, label, "三餐都有紀錄", "天"]
    : [label, label, "三餐都有紀錄", "人"];
  return `<div class="stats range-metrics">${cards
    .map(
      ([title, value], index) =>
        `<section class="range-card"><p>${title}</p><strong>${value}</strong><small>${feet[index]}</small></section>`,
    )
    .join("")}</div>`;
}

// 【新增】用來渲染營養素欄位的輔助函式（上方顯示 %，下方顯示攝取量／目標與差距）
function nutrientCell(rateValue, detail) {
  if (!detail) return percent(rateValue);
  return `<strong>${percent(rateValue)}</strong><small>${esc(detail.text)}</small>`;
}

function rangeTable(rows) {
  if (!rows.length) return empty("這個區段沒有可查看的球員");
  return `<div class="table-wrap"><table class="range-table"><thead><tr><th>球員</th><th>紀錄完整率</th><th>熱量</th><th>蛋白質</th><th>碳水</th><th>脂肪</th><th>達標天數</th><th>趨勢</th><th>狀態</th></tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr><td><div class="person">${avatar(row.player)}<div><strong>${esc(row.player.name)} #${row.player.number}</strong><small>${esc(row.player.sport || "籃球")} · ${esc(row.player.position || "")}</small></div></div></td><td><strong>${row.completeness}%</strong><small>${row.recordedMeals} /${row.expectedMeals}</small></td><td>${nutrientCell(row.calorieRate, row.calorieDetail)}</td><td>${nutrientCell(row.proteinRate, row.proteinDetail)}</td><td>${nutrientCell(row.carbRate, row.carbDetail)}</td><td>${nutrientCell(row.fatRate, row.fatDetail)}</td><td>${row.hitDays} /${row.dayCount}</td><td><span class="trend trend-${row.trend}" aria-label="${row.trend}">${TREND[row.trend]}</span></td><td>${row.alerts.map((alert) => badge(alert.label, alert.tone)).join(" ")}</td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function rangeBoard(data, players, state) {
  const bounds = rangeBounds(state.rangePreset || "7", data.date, state.rangeStart, state.rangeEnd);
  const summary = rangeSummary(players, data.records, datesInRange(bounds.start, bounds.end));
  const solo = players.length <= 1;
  const options = [
    ["today", "今日"],
    ["7", "近 7 天"],
    ["30", "近 30 天"],
    ["custom", "自訂日期"],
  ];

  const isSingleDay = bounds.start === bounds.end;
  const desc = isSingleDay
    ? "目前顯示單日攝取量、當日目標與差距。達標條件為熱量落在 80%–115%、且蛋白質至少 80%。"
    : "目前顯示區間每日平均攝取量、平均目標與差距（達成率先依各日目標計算，再取平均；無紀錄或無目標之日期不計入）。";

  return `<section class="range-board"><p class="range-lead">切換時間區段，看平均達成率、達標天數、紀錄完整率和異常原因。</p><div class="range-switch" role="tablist">${options
    .map(
      ([id, label]) =>
        `<button type="button" class="range-pill ${bounds.preset === id ? "active" : ""}" data-action="range" data-id="${id}" role="tab" aria-selected="${bounds.preset === id}">${label}</button>`,
    )
    .join(
      "",
    )}</div><div class="range-fields"><label>開始<input type="date" id="range-start" aria-label="開始日期" value="${esc(bounds.start)}"></label><label>結束<input type="date" id="range-end" aria-label="結束日期" value="${esc(bounds.end)}"></label></div>${rangeCards(summary, periodLabel(bounds.preset), solo)}<section class="panel"><div class="panel-heading"><div><h2>球員營養達成狀況</h2><p>${desc}</p></div></div>${rangeTable(summary.rows)}</section></section>`;
}

function dailyColumn(data, filter, players) {
  if (!players.length)
    return `<section class="daily-column"><div class="section-title"><h2>球員每日營養表現</h2></div>${empty("這個日期沒有可查看的球員")}</section>`;
  const values = players.map((player) => player.rate);
  const chart = `<section class="panel chart-panel"><div class="panel-heading"><div><h2>球員營養達成概況</h2><p>每日熱量攝取與目標比較</p></div><span class="legend"><i></i> 熱量達成率</span></div><div class="bar-chart"><div class="axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div class="bars">${players
    .map(
      (player, index) =>
        `<div class="bar-column"><div class="bar-track"><div class="chart-bar ${player.tone}" style="height:${values[index] == null ? 0 : Math.min(100, values[index])}%" ><span>${percent(values[index])}</span></div></div><small>${esc(player.name)}</small></div>`,
    )
    .join("")}</div></div><div class="chart-note">${icon("target")} 以右上角日期的當日紀錄計算。</div></section>`;
  const matched = players.filter(
    (player) => player.name.includes(filter) || String(player.number).includes(filter),
  );
  const personal = `<section class="panel"><div class="toolbar analysis-toolbar"><label class="search">${icon("search")}<input id="search" placeholder="搜尋球員姓名或背號" value="${esc(filter)}"></label></div>${matched.length ? playerTable(matched) : empty("找不到符合的球員")}</section>`;
  return `<section class="daily-column"><div class="section-title"><h2>球員每日營養表現</h2></div>${chart}${personal}</section>`;
}

/** 球員只看自己。營養師與教練看名單，並多一欄當日達成。 */
export function analysisView(data, role, filter = "", state = {}) {
  const self = data.players.find((player) => player.id === (data.athleteId || "p1")) || data.players[0];
  const players = role === "player" ? (self ? [self] : []) : data.players;
  return `${rangeBoard(data, players, state)}${role === "player" ? "" : dailyColumn(data, filter, players)}`;
}
