import { profileView } from "./profile.js";
import { cameraView } from "./camera.js";
import { coachDashboard, playerDashboard } from "./workflows.js";
import {
  icon,
  badge,
  avatar,
  progress,
  playerTable,
  esc,
  empty,
  button,
} from "../components/ui.js";
export const navigation = [
  ["dashboard", "grid", "總覽儀表板"],
  ["profile", "users", "個人資料"],
  ["foods", "food", "菜色營養資料庫"],
  ["camera", "food", "食物攝影機"],
  ["targets", "target", "營養目標"],
  ["records", "camera", "飲食紀錄"],
  ["analysis", "chart", "營養分析"],
];
export function allowed(role) {
  return navigation.filter(([id]) => {
    if (id === "profile") return role === "player";
    if (role === "nutritionist") return !["camera", "dashboard"].includes(id);
    if (role === "coach") return !["foods", "targets", "camera"].includes(id);
    return ["dashboard", "camera", "records", "analysis"].includes(id);
  });
}
const labels = {
  profile: ["個人資料", "更新基本資料、訓練狀況與飲食注意事項。"],
  dashboard: ["營養分析", "掌握全隊營養達成率與個人營養表現。"],
  foods: ["菜色營養資料庫", "從每一道菜開始，建立科學化的營養補給。"],
  camera: ["食物攝影機", "辨識餐盤食物，自動計算每餐營養。"],
  targets: [
    "每日營養目標",
    "設定總熱量，分配三大營養素，追蹤攝影機記錄的實際攝取。",
  ],
  records: ["飲食紀錄", "記錄每一餐，看見持續累積的進步。"],
  analysis: ["營養分析", "讓飲食數據，成為訓練表現的助力。"],
  kiosk: ["營養餐秤站", "請放上餐盤並選擇您的名字"],
};
export function pageHeader(route, role, player) {
  let [title, sub] = labels[route] || labels.dashboard;
  if (role === "player" && route === "dashboard") {
    title = "球員首頁";
    sub = `${player?.name || "球員"} · 今天的營養目標與飲食進度`;
  }
  if (role === "coach" && route === "dashboard") {
    title = "球員飲食監督";
    sub = "教練查看飲食紀錄與營養目標達成率。";
  }
  return `<div class="page-heading"><div><h1>${title}</h1><p>${esc(sub)}</p></div><div class="heading-actions"><span class="role-tag">${{ nutritionist: "營養師", coach: "教練", player: "球員" }[role]}</span>${role === "player" ? button(icon("plus") + " 記錄飲食", "record", true) : ""}</div></div>`;
}
function stats(d) {
  const {
    averageRate: avg,
    completedPlayers: done,
    attentionPlayers: attention,
  } = d.summary;
  return `<div class="stats">${[
    [
      "團隊球員",
      d.players.length,
      "位",
      "users",
      "全隊健康，由日常開始",
      "green",
    ],
    [
      "今日餐點完成",
      done,
      "/ " + d.players.length,
      "menu",
      "已完成至少兩餐飲食紀錄",
      "green",
    ],
    ["平均熱量達成率", avg, "%", "fire", "依今日實際飲食紀錄計算", "green"],
    [
      "需要關注",
      attention,
      "位",
      "target",
      "留意攝取不足與未記錄球員",
      "orange",
    ],
  ]
    .map(
      ([l, n, u, i, s, t]) =>
        `<section class="stat-card"><div class="stat-top">${l}<span class="stat-icon ${t}">${icon(i)}</span></div><div class="stat-number">${n}<span>${u}</span></div><div class="stat-foot ${t}">${t === "green" ? "↗" : "◷"} <span>${s}</span></div></section>`,
    )
    .join("")}</div>`;
}
function chart(d) {
  const values = d.players.map((p) => p.rate);
  return `<section class="panel chart-panel"><div class="panel-heading"><div><h2>球員營養達成概況</h2><p>每日熱量攝取與目標比較</p></div><span class="legend"><i></i> 熱量達成率</span></div><div class="bar-chart"><div class="axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div class="bars">${d.players.map((p, i) => `<div class="bar-column"><div class="bar-track"><div class="chart-bar ${p.tone}" style="height:${Math.min(100, values[i])}%"><span>${values[i]}%</span></div></div><small>${esc(p.name)}</small></div>`).join("")}</div></div><div class="chart-note">${icon("target")} 持續完成每餐紀錄，讓營養達成更有方向。</div></section>`;
}
export function view(route, d, role, filter = "", state = {}) {
  if (route === "dashboard" && role === "coach")
    return coachDashboard(d, state.comparisonPlayer);
  if (route === "dashboard" && role === "player") return playerDashboard(d);
  if (route === "profile" && role === "player") return profileView(d);
  if (route === "targets") return '<div id="targets-root"></div>';
  if (route === "foods")
    return `<section class="panel"><div class="panel-heading"><div><h2>所有菜色 <span class="count">${d.foods.length}</span></h2><p>營養資訊皆以每 100 公克計算</p></div>${button(icon("plus") + " 新增菜色", "new-food", true)}</div><div class="toolbar"><label class="search">${icon("search")}<input id="search" placeholder="搜尋菜色名稱" value="${esc(filter)}"></label></div><div class="food-grid">${
      d.foods
        .filter((f) => f.name.includes(filter))
        .map(
          (f) =>
            `<article class="food-card"><div class="food-emoji">${f.emoji}</div><div>${badge(f.category, "neutral")}<h3>${esc(f.name)}</h3><strong>${f.calories} <small>kcal / 100g</small></strong><p>蛋白質 ${f.protein}g · 碳水 ${f.carbs}g · 脂肪 ${f.fat}g</p></div></article>`,
        )
        .join("") || empty("找不到符合的菜色")
    }</div></section>`;
  if (route === "camera") return cameraView(d);
  if (route === "records") {
    const records = d.records.filter(
      (r) => (role !== "player" || r.playerId === "p1") && r.date === d.date,
    );
    return `<section class="panel"><div class="panel-heading"><div><h2>每日飲食紀錄</h2><p>照片、份量與人工確認結果，一目了然</p></div>${role === "player" ? button("＋ 新增紀錄", "record", true) : ""}</div>${records.length ? `<div class="table-wrap"><table><thead><tr><th>球員</th><th>餐別 / 時間</th><th>餐點內容</th><th>熱量</th><th>紀錄來源</th><th></th></tr></thead><tbody>${records.map((r) => `<tr><td><div class="person">${avatar(r.player)}<strong>${esc(r.player.name)}</strong></div></td><td>${r.meal}<small>${r.date} ${r.time}</small></td><td class="food-names">${esc(r.foodNames)}</td><td><strong>${r.nutrition.calories}</strong> kcal</td><td>${badge(r.source, "neutral")}</td><td><button class="icon-btn" data-action="record-detail" data-id="${r.id}" aria-label="查看紀錄">${icon("chevron")}</button></td></tr>`).join("")}</tbody></table></div>` : empty("這一天還沒有飲食紀錄")}</section>`;
  }
  if (route === "analysis")
    return role === "player"
      ? personal(d)
      : `${stats(d)}${chart(d)}<div class="section-title"><h2>個人營養表現</h2>${role === "nutritionist" ? button(icon("plus") + " 新增球員", "new-player", true) : ""}</div><section class="panel"><div class="toolbar analysis-toolbar"><label class="search">${icon("search")}<input id="search" placeholder="搜尋球員姓名或背號" value="${esc(filter)}"></label></div>${playerTable(d.players.filter((p) => p.name.includes(filter) || String(p.number).includes(filter)))}</section>`;
  if (route === "kiosk")
    return `<section class="panel kiosk"><div class="kiosk-symbol">${icon("camera")}</div><h2>放上餐盤，開始您的營養紀錄</h2><p>現場設備尚未串接，此處提供操作流程示範。</p><div class="kiosk-players">${d.players.map((p) => `<button data-action="kiosk-player" data-id="${p.id}">${avatar(p)}<strong>${esc(p.name)}</strong><small>#${p.number}</small></button>`).join("")}</div></section>`;
  return empty();
}
function personal(d) {
  const p = d.players.find((p) => p.id === "p1");
  return `<section class="personal-banner"><div><span class="eyebrow">YOUR DAILY FUEL</span><h2>${esc(p.name)}，每一餐都更接近目標。</h2><p>今天的好表現，從均衡補給開始。</p></div>${button(icon("camera") + " 記錄我的餐點", "record", true)}</section><div class="stats">${[
    ["calories", "熱量", "kcal"],
    ["protein", "蛋白質", "g"],
    ["carbs", "碳水化合物", "g"],
    ["fat", "脂肪", "g"],
  ]
    .map(
      ([k, l, u]) =>
        `<section class="stat-card"><div class="stat-top">${l}${icon("target")}</div><div class="stat-number">${p.totals[k]}<span>${u}</span></div>${progress((p.totals[k] / p.target[k]) * 100)}<p class="muted">每日目標 ${p.target[k]} ${u}</p></section>`,
    )
    .join("")}</div>`;
}
