/**
 * 登入頁、教練首頁與球員首頁的畫面。
 */
import { athleteDetails } from "../../components/athlete-card.js";
import { esc, progress, playerTable, icon, percent, shown } from "../../components/ui.js";
import { playerDaily } from "../../services/dashboard.service.js";
export function loginView(directory = []) {
  const account = directory.find((item) => item.id === "acct-n1");
  const email = account?.email || "lin.yian@example.com";
  return `<section class="login panel"><h1>登入頁</h1><p class="muted">測試帳號已填好，直接進入。</p><form id="demo-login"><label class="field">帳號<input name="account" value="${esc(email)}" aria-label="登入帳號" readonly></label><input name="accountId" type="hidden" value="acct-n1"><label class="field">密碼<input type="password" value="demopass" aria-label="示意密碼" readonly></label><div class="form-error" role="alert"></div><div class="actions"><button type="submit" class="btn primary">進入</button></div><p class="footnote">測試帳號是營養師林怡安。密碼僅供示意。</p></form></section>`;
}
export function coachDashboard(data, selectedPlayerId = "p1") {
  if (!data.players.length)
    return `<section class="panel panel-padded"><h2>這個日期沒有指派中的球員</h2><p>教練只能查看指派開始日到結束日之間的球員。請換一天再看。</p></section>`;
  const daily = playerDaily(data, selectedPlayerId);
  const { recordedPlayers, averageRate, attentionPlayers } = data.summary;
  const rates = data.players.map((player) => player.rate);
  return `<div class="stats">${[
    ["球員人數", data.players.length, "位", "users", "本季名單上的球員", "green"],
    ["今日已記錄", recordedPlayers, "位", "menu", "今天已有飲食紀錄", "green"],
    [
      "平均熱量達成率",
      averageRate == null ? "未設定" : shown(averageRate),
      averageRate == null ? "" : "%",
      "fire",
      "依今日實際飲食紀錄計算",
      "green",
    ],
    [
      "需留意",
      attentionPlayers,
      "位",
      "target",
      "攝取不足或尚未記錄",
      "orange",
    ],
  ]
    .map(
      ([label, value, unit, glyph, note, tone]) =>
        `<section class="stat-card"><div class="stat-top">${label}<span class="stat-icon ${tone}">${icon(glyph)}</span></div><div class="stat-number">${value}<span>${unit}</span></div><div class="stat-foot ${tone}">${tone === "green" ? "↗" : "◷"} <span>${note}</span></div></section>`,
    )
    .join(
      "",
    )}</div><section class="panel chart-panel"><div class="panel-heading"><div><h2>球員營養達成概況</h2><p>每日熱量攝取與目標比較</p></div><span class="legend"><i></i> 熱量達成率</span></div><div class="bar-chart"><div class="axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div class="bars">${data.players.map((player, index) => `<div class="bar-column"><div class="bar-track"><div class="chart-bar ${player.tone}" style="height:${rates[index] == null ? 0 : Math.min(100, rates[index])}%"><span>${percent(rates[index])}</span></div></div><small>${esc(player.name)}</small></div>`).join("")}</div></div><div class="chart-note">${icon("target")} 持續完成每餐紀錄，讓營養達成更有方向。</div></section><section class="panel"><div class="panel-heading"><div><h2>球員今日狀況</h2><p>只列出今天仍在指派期間內的球員</p></div></div>${playerTable(data.players)}</section><section class="panel panel-padded comparison-panel"><div class="comparison-heading"><h2>營養目標與實際飲食</h2><label>球員 <select id="comparison-player" aria-label="選擇對照球員">${data.players.map((p) => `<option value="${p.id}" ${p.id === daily.player.id ? "selected" : ""}>${esc(p.name)} #${p.number}</option>`).join("")}</select></label></div>${athleteDetails(daily.player, true)}<div class="workflow-grid equal"><div><h3>每日營養目標</h3>${[
    ["calories", "熱量", "kcal"],
    ["protein", "蛋白質", "g"],
    ["carbs", "碳水", "g"],
    ["fat", "脂肪", "g"],
  ]
    .map(
      ([key, label, unit]) =>
        `<div class="data-row">${label}：${shown(daily.player.totals[key])} / ${shown(daily.player.target?.[key])} ${unit}</div>`,
    )
    .join(
      "",
    )}</div><div><h3>球員實際記錄</h3>${daily.meals.map((meal) => `<div class="data-row ${meal.recorded ? "" : "warn"}">${meal.meal}：${esc(meal.actual || "尚未記錄")}</div>`).join("")}</div></div></section>`;
}
function nutritionStandard(player) {
  const items = [
    ["calories", "熱量", "kcal"],
    ["protein", "蛋白質", "g"],
    ["carbs", "碳水", "g"],
    ["fat", "脂肪", "g"],
  ];
  return `<section class="panel panel-padded standard-card"><h2>營養師給你的標準</h2><p class="standard-meta">${esc(player.sport || "未填寫")} · 教練 ${esc(player.coachName || "未指派")}</p><p class="muted">深色是今天已經記錄的，淺色是距離營養師指定還差的量。</p><div class="standard-pies">${items
    .map(([key, label, unit]) => {
      const target = player.target?.[key];
      const recorded = player.totals[key];
      if (target == null)
        return `<article class="standard-pie"><strong>${label}</strong><p>指定 未設定</p><p>已記錄 ${shown(recorded)} ${unit}</p></article>`;
      const fill =
        target > 0 ? Math.max(0, Math.min(100, (recorded / target) * 100)) : 0;
      const gapText =
        recorded > target
          ? `已超出 ${shown(recorded - target)} ${unit}`
          : `還差 ${shown(Math.max(0, target - recorded))} ${unit}`;
      return `<article class="standard-pie"><div class="macro-pie" style="--fill:${fill}%" role="img" aria-label="${label}已記錄 ${percent(Math.round(fill))}"></div><strong>${label}</strong><p>指定 ${shown(target)} ${unit}</p><p>已記錄 ${shown(recorded)} ${unit}</p><p class="gap">${gapText}</p></article>`;
    })
    .join("")}</div><p class="standard-limit">飲食限制：${esc(player.dietaryRestrictions || "未填寫")}</p></section>`;
}
export function playerDashboard(data) {
  const { player, meals, recordedCount, proteinRate } = playerDaily(
    data,
    data.athleteId || data.players[0]?.id,
  );
  return `${nutritionStandard(player)}<div class="stats three-stats"><section class="stat-card"><span class="label">今日熱量</span><strong class="stat-number">${shown(player.totals.calories)} <small>kcal</small></strong><span class="muted">目標 ${shown(player.target?.calories)} kcal</span></section><section class="stat-card"><span class="label">蛋白質</span><strong class="stat-number">${percent(proteinRate)}</strong>${progress(proteinRate || 0)}</section><section class="stat-card"><span class="label">已記錄餐次</span><strong class="stat-number">${recordedCount} / 3</strong><span class="muted">${recordedCount === 3 ? "今日三餐皆已記錄" : "持續記錄，掌握每日攝取"}</span></section></div><div class="workflow-grid equal"><section class="panel panel-padded"><h2>今日飲食紀錄</h2>${meals.map((meal) => `<div class="data-row"><div><strong>${meal.meal}</strong><small>${esc(meal.actual || "尚無攝影機飲食紀錄")}</small></div><span class="${meal.recorded ? "good" : "warn"}">${meal.recorded ? "已記錄" : "尚未記錄"}</span></div>`).join("")}</section><section class="panel panel-padded"><h2>今日營養攝取</h2>${[
    ["protein", "蛋白質", "g"],
    ["carbs", "碳水化合物", "g"],
    ["fat", "脂肪", "g"],
  ]
    .map(
      ([key, label, unit]) =>
        `<div class="data-row"><strong>${label}</strong><span>${shown(player.totals[key])} / ${shown(player.target?.[key])} ${unit}</span></div>`,
    )
    .join(
      "",
    )}<p class="footnote">攝影機辨識餐盤後，系統依菜色營養資料表與食物重量自動計算攝取量。</p></section></div>`;
}
