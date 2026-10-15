/**
 * 登入頁、教練首頁與球員首頁的畫面。
 */
import { athleteDetails } from "../../components/athlete-card.js";
import { esc, progress, icon, percent, shown } from "../../components/ui.js";
import { MAIN_MEALS, mealHasItems, playerDaily } from "../../services/dashboard.service.js";
import { datesInRange, periodLabel, rangeBounds, rangeSummary } from "../../services/rangeStats.js";
import { rangeBoard } from "./analysis.js";
export function loginView(directory = []) {
  const account = directory.find((item) => item.id === "acct-n1");
  const email = account?.email || "lin.yian@example.com";
  return `<section class="login panel"><h1>登入頁</h1><p class="muted">測試帳號已填好，直接進入。</p><form id="demo-login"><label class="field">帳號<input name="account" value="${esc(email)}" aria-label="登入帳號" readonly></label><input name="accountId" type="hidden" value="acct-n1"><label class="field">密碼<input type="password" value="demopass" aria-label="示意密碼" readonly></label><div class="form-error" role="alert"></div><div class="actions"><button type="submit" class="btn primary">進入</button></div><p class="footnote">測試帳號是營養師林怡安。密碼僅供示意。</p></form></section>`;
}
function missingMeals(data) {
  return data.players.flatMap((player) => {
    const recorded = new Set(
      data.records
        .filter(
          (record) =>
            record.date === data.date &&
            record.playerId === player.id &&
            record.status !== "draft" &&
            mealHasItems(record) &&
            MAIN_MEALS.includes(record.meal),
        )
        .map((record) => record.meal),
    );
    const missing = MAIN_MEALS.filter((meal) => !recorded.has(meal));
    return missing.length ? [{ player, missing }] : [];
  });
}
function intakeBar(key, totals, target) {
  const goal = target?.[key];
  const recorded = totals?.[key];
  if (goal == null || !(goal > 0) || recorded == null) return "";
  const rate = (recorded / goal) * 100;
  let tone = "green";
  if (key === "calories") tone = rate < 80 ? "yellow" : rate > 115 ? "red" : "green";
  else if (key === "protein" || key === "carbs") tone = rate < 80 ? "yellow" : "green";
  else if (key === "fat") tone = rate > 130 ? "red" : "green";
  return progress(rate, tone);
}
function missingMealPanel(data) {
  const rows = missingMeals(data);
  const body = rows.length
    ? `<div class="missing-meals">${rows
        .map(({ player, missing }) => {
          const number = player.number === "" || player.number == null ? "" : ` #${esc(player.number)}`;
          return `<div class="data-row"><strong>${esc(player.name)}${number}</strong><span>缺${missing.join("、")}</span></div>`;
        })
        .join("")}</div>`
    : `<p class="muted missing-empty">今天三餐都已記錄。</p>`;
  return `<section class="panel"><div class="panel-heading"><div><h2>今天還沒記的餐</h2><p>只列出早餐、午餐或晚餐還沒記錄的球員。</p></div></div>${body}</section>`;
}
export function coachDashboard(data, selectedPlayerId = "p1") {
  if (!data.players.length)
    return `<section class="panel panel-padded"><h2>這個日期沒有指派中的球員</h2><p>教練只能查看指派開始日到結束日之間的球員。請換一天再看。</p></section>`;
  const daily = playerDaily(data, selectedPlayerId);
  const { recordedPlayers, attentionPlayers } = data.summary;
  const cards = [
    ["球員人數", data.players.length, "位", "users", "本季名單上的球員", "green"],
    ["今日已記錄", recordedPlayers, "位", "menu", "今天已有飲食紀錄", "green"],
    ["需留意", attentionPlayers, "位", "target", "攝取不足或尚未記錄", "orange"],
  ]
    .map(
      ([label, value, unit, glyph, note, tone]) =>
        `<section class="stat-card"><div class="stat-top">${label}<span class="stat-icon ${tone}">${icon(glyph)}</span></div><div class="stat-number">${value}<span>${unit}</span></div><div class="stat-foot ${tone}">${tone === "green" ? "↗" : "◷"} <span>${note}</span></div></section>`,
    )
    .join("");
  return `<div class="stats three-stats">${cards}</div><div class="workflow-grid supervision-pair"><section class="panel panel-padded comparison-panel"><div class="comparison-heading"><label class="player-filter">球員 <select id="comparison-player" aria-label="選擇對照球員">${data.players.map((p) => `<option value="${p.id}" ${p.id === daily.player.id ? "selected" : ""}>${esc(p.name)} #${p.number}</option>`).join("")}</select></label><h2>營養目標與實際飲食</h2></div><details class="player-facts"><summary>球員資料</summary>${athleteDetails(daily.player)}</details><div class="workflow-grid equal"><div><h3>每日營養目標</h3>${[
    ["calories", "熱量", "kcal"],
    ["protein", "蛋白質", "g"],
    ["carbs", "碳水", "g"],
    ["fat", "脂肪", "g"],
  ]
    .map(
      ([key, label, unit]) =>
        `<div class="data-row">${label}：${shown(daily.player.totals[key])} / ${shown(daily.player.target?.[key])} ${unit}${intakeBar(key, daily.player.totals, daily.player.target)}</div>`,
    )
    .join(
      "",
    )}</div><div><h3>球員實際記錄</h3>${daily.meals.map((meal) => `<div class="data-row ${meal.recorded ? "" : "warn"}">${meal.meal}：${esc(meal.actual || "尚未記錄")}</div>`).join("")}</div></div></section>${missingMealPanel(data)}</div>`;
}
const RANGE_RATE = { calories: "calorieRate", protein: "proteinRate", carbs: "carbRate", fat: "fatRate" };

function pieTone(row, key) {
  const level = row.alerts?.find((alert) => alert.nutrient === RANGE_RATE[key])?.level;
  if (level === "high") return "red";
  if (level === "low") return "yellow";
  if (level === "ok") return "green";
  return "neutral";
}
function nutritionStandard(player, totals, target, row, caption) {
  const items = [
    ["calories", "熱量", "kcal"],
    ["protein", "蛋白質", "g"],
    ["carbs", "碳水", "g"],
    ["fat", "脂肪", "g"],
  ];
  return `<section class="panel panel-padded standard-card"><h2>營養師給你的標準</h2><p class="standard-meta">${esc(player.sport || "未填寫")} · 教練 ${esc(player.coachName || "未指派")}</p><p class="muted">${caption}</p><div class="standard-pies">${items
    .map(([key, label, unit]) => {
      const goal = target?.[key];
      const recorded = totals?.[key];
      const tone = pieTone(row, key);
      const rate = row?.[RANGE_RATE[key]];
      const fill = goal == null || rate == null ? 0 : Math.max(0, Math.min(100, rate));
      const gapText =
        goal == null
          ? ""
          : recorded > goal
            ? `已超出 ${shown(recorded - goal)} ${unit}`
            : `還差 ${shown(Math.max(0, goal - recorded))} ${unit}`;
      return `<article class="standard-pie"><div class="macro-pie ${tone}" style="--fill:${fill}%" role="img" aria-label="${label}${tone === "green" ? "符合" : tone === "red" ? "過高" : tone === "yellow" ? "過低" : "未設定"}"></div><strong>${label}</strong><p>指定 ${shown(goal)} ${unit}</p><p>已記錄 ${shown(recorded)} ${unit}</p>${gapText ? `<p class="gap ${tone}">${gapText}</p>` : ""}</article>`;
    })
    .join("")}</div><p class="standard-limit">飲食限制：${esc(player.dietaryRestrictions || "未填寫")}</p></section>`;
}
export function playerDashboard(data, state = {}) {
  const self =
    data.players.find((player) => player.id === (data.athleteId || data.players[0]?.id)) ||
    data.players[0];
  if (!self) return `<section class="panel panel-padded"><h2>沒有可查看的資料</h2></section>`;
  const bounds = rangeBounds(state.rangePreset || "7", data.date, state.rangeStart, state.rangeEnd);
  const summary = rangeSummary([self], data.records, datesInRange(bounds.start, bounds.end));
  const row = summary.rows[0];
  const single = bounds.preset === "today";
  const period = periodLabel(bounds.preset);
  const amountNote = single ? "深色是這一天已記錄的量。" : "深色是有紀錄日期的每日平均。";
  const caption = `${amountNote}綠色是符合，紅色是過高，黃色是過低。熱量以 80%–115% 為符合，高於 115% 為過高，低於 80% 為過低。蛋白質與碳水低於 80% 為過低。脂肪高於 130% 為過高。沒有目標時是灰色。`;
  const { meals } = playerDaily(data, self.id);
  const mealNote = single
    ? row.recordedMeals >= 3
      ? "今日三餐皆已記錄"
      : "持續記錄，掌握每日攝取"
    : `${period}的早餐、午餐、晚餐`;
  return `${rangeBoard(data, [self], state, { table: false })}${nutritionStandard(self, row.rangeIntake, row.rangeTarget, row, caption)}<div class="stats three-stats"><section class="stat-card"><span class="label">${single ? "當日熱量" : "平均熱量"}</span><strong class="stat-number">${shown(row.rangeIntake.calories)} <small>kcal</small></strong><span class="muted">目標 ${shown(row.rangeTarget.calories)} kcal</span></section><section class="stat-card"><span class="label">蛋白質</span><strong class="stat-number">${percent(row.proteinRate)}</strong>${progress(row.proteinRate || 0)}</section><section class="stat-card"><span class="label">已記錄餐次</span><strong class="stat-number">${row.recordedMeals} / ${row.expectedMeals}</strong><span class="muted">${mealNote}</span></section></div><div class="workflow-grid equal"><section class="panel panel-padded"><h2>${esc(data.date)} 飲食紀錄</h2>${meals.map((meal) => `<div class="data-row"><div><strong>${meal.meal}</strong><small>${esc(meal.actual || "尚無攝影機飲食紀錄")}</small></div><span class="${meal.recorded ? "good" : "warn"}">${meal.recorded ? "已記錄" : "尚未記錄"}</span></div>`).join("")}</section><section class="panel panel-padded"><h2>${single ? "當日營養攝取" : `${period}平均攝取`}</h2>${[
    ["protein", "蛋白質", "g"],
    ["carbs", "碳水化合物", "g"],
    ["fat", "脂肪", "g"],
  ]
    .map(
      ([key, label, unit]) =>
        `<div class="data-row"><strong>${label}</strong><span>${shown(row.rangeIntake[key])} / ${shown(row.rangeTarget[key])} ${unit}</span></div>`,
    )
    .join(
      "",
    )}<p class="footnote">攝影機辨識餐盤後，系統依菜色營養資料表與食物重量自動計算攝取量。</p></section></div>`;
}
