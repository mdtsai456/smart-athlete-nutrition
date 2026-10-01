/**
 * 角色操作頁面
 * 產生示範登入頁、教練監督首頁與球員首頁，使用 Service 整理的資料及共用 UI 元件呈現內容。
 */
import { athleteDetails } from "../components/athlete.js";
import { esc, button, progress, playerTable } from "../components/ui.js";
import { roles } from "../services/platform.js";
import { playerDaily } from "../services/workspace.js";

export function loginView(role) {
  return `<section class="login panel"><h1>登入頁</h1><p class="muted">選擇角色，預覽各自的頁面與操作流程。</p><form id="demo-login"><label class="field">帳號<input value="demo@example.com" aria-label="示意帳號" readonly></label><label class="field">密碼<input type="password" value="demopass" aria-label="示意密碼" readonly></label><label class="field">身分<select name="loginRole">${Object.entries(
    roles,
  )
    .map(
      ([value, label]) =>
        `<option value="${value}" ${role === value ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></label><div class="actions"><button type="submit" class="btn primary">進入示意頁</button></div><p class="footnote">這是前端原型，示範帳號與密碼不會送出，也不會儲存。</p></form></section>`;
}
export function coachDashboard(data, selectedPlayerId = "p1") {
  const daily = playerDaily(data, selectedPlayerId);
  return `<div class="stats three-stats">${[
    ["球員人數", data.players.length],
    ["今日已記錄", data.summary.recordedPlayers],
    ["需留意", data.summary.attentionPlayers],
  ]
    .map(
      ([label, value]) =>
        `<section class="stat-card"><span class="label">${label}</span><strong class="stat-number">${value}</strong></section>`,
    )
    .join(
      "",
    )}</div><section class="panel"><div class="panel-heading"><h2>球員今日狀況</h2></div>${playerTable(data.players)}</section><section class="panel panel-padded comparison-panel"><div class="comparison-heading"><h2>營養目標與實際飲食</h2><label>球員 <select id="comparison-player" aria-label="選擇對照球員">${data.players.map((p) => `<option value="${p.id}" ${p.id === daily.player.id ? "selected" : ""}>${esc(p.name)} #${p.number}</option>`).join("")}</select></label></div>${athleteDetails(daily.player, true)}<div class="workflow-grid equal"><div><h3>每日營養目標</h3>${[
    ["calories", "熱量", "kcal"],
    ["protein", "蛋白質", "g"],
    ["carbs", "碳水", "g"],
    ["fat", "脂肪", "g"],
  ]
    .map(
      ([key, label, unit]) =>
        `<div class="data-row">${label}：${daily.player.totals[key]} / ${daily.player.target[key]} ${unit}</div>`,
    )
    .join(
      "",
    )}</div><div><h3>球員實際記錄</h3>${daily.meals.map((meal) => `<div class="data-row ${meal.recorded ? "" : "warn"}">${meal.meal}：${esc(meal.actual || "尚未記錄")}</div>`).join("")}</div></div></section>`;
}
export function playerDashboard(data) {
  const { player, meals, recordedCount, proteinRate } = playerDaily(data);
  return `<div class="profile-shortcut"><span>基本資料、訓練與飲食注意事項</span><a class="btn" href="#profile">填寫／更新個人資料 ↗</a></div><div class="stats three-stats"><section class="stat-card"><span class="label">今日熱量</span><strong class="stat-number">${player.totals.calories.toLocaleString()} <small>kcal</small></strong><span class="muted">目標 ${player.target.calories.toLocaleString()} kcal</span></section><section class="stat-card"><span class="label">蛋白質</span><strong class="stat-number">${proteinRate}%</strong>${progress(proteinRate)}</section><section class="stat-card"><span class="label">已記錄餐次</span><strong class="stat-number">${recordedCount} / 3</strong><span class="muted">${recordedCount === 3 ? "今日三餐皆已記錄" : "持續記錄，掌握每日攝取"}</span></section></div><div class="workflow-grid equal"><section class="panel panel-padded"><h2>今日飲食紀錄</h2>${meals.map((meal) => `<div class="data-row"><div><strong>${meal.meal}</strong><small>${esc(meal.actual || "尚無攝影機飲食紀錄")}</small></div><span class="${meal.recorded ? "good" : "warn"}">${meal.recorded ? "已記錄" : "尚未記錄"}</span></div>`).join("")}<div class="actions">${button("使用食物攝影機", "record", true)}</div></section><section class="panel panel-padded"><h2>今日營養攝取</h2>${[
    ["protein", "蛋白質", "g"],
    ["carbs", "碳水化合物", "g"],
    ["fat", "脂肪", "g"],
  ]
    .map(
      ([key, label, unit]) =>
        `<div class="data-row"><strong>${label}</strong><span>${player.totals[key]} / ${player.target[key]} ${unit}</span></div>`,
    )
    .join(
      "",
    )}<p class="footnote">攝影機辨識餐盤後，系統依菜色營養資料表與食物重量自動計算攝取量。</p><div class="actions"><a class="btn" href="#camera">食物攝影機</a></div></section></div>`;
}
