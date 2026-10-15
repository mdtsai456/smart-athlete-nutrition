/**
 * 頂部列與頁面標題。
 * 記錄飲食按鈕只在球員首頁。
 */
import { button, esc, icon, roles } from "./ui.js";
import { signInError } from "../services/auth.service.js";
import { pageUrl } from "../core/router.js";
const labels = {
  profile: ["個人資料", "更新基本資料、訓練狀況與飲食注意事項。"],
  dashboard: ["營養分析", "掌握全隊營養達成率與個人營養表現。"],
  foods: ["菜色營養資料庫", "從每一道菜開始，建立科學化的營養補給。"],
  camera: ["食物攝影機", "辨識餐盤食物，自動計算每餐營養。"],
  targets: ["每日營養目標", "上面存訓練日與休息日兩組範本。這一週排好的日子會套用對應範本，還沒排的日子是待確認。"],
  records: ["飲食紀錄", "記錄每一餐，看見持續累積的進步。"],
  analysis: ["營養分析", "依時間區段看達成率與熱量長條圖。"],
  kiosk: ["營養餐秤站", "請放上餐盤並選擇您的名字"],
};
export function pageHeader(route, role, player) {
  let [title, sub] = labels[route] || labels.dashboard;
  if (role === "player" && route === "dashboard") {
    title = "球員首頁";
    sub = `${player?.name || "球員"} · 營養目標與飲食進度`;
  }
  if (role === "coach" && route === "dashboard") {
    title = "球員飲食監督";
    sub = "看今天誰還沒記錄，以及一位球員實際吃了什麼。";
  }
  return `<div class="page-heading"><div><h1>${title}</h1><p>${esc(sub)}</p></div><div class="heading-actions"><span class="role-tag">${roles[role] || ""}</span>${role === "player" && route === "dashboard" ? button(icon("plus") + " 記錄飲食", "record", true) : ""}</div></div>`;
}
export function header(state) {
  const accounts = (state.data?.directory || []).filter((account) => !signInError(account));
  const signedIn = state.data?.account;
  const switcher =
    state.route === "login"
      ? ""
      : `<label class="role-switch"><select id="account" aria-label="切換帳號">${accounts
          .map(
            (account) =>
              `<option value="${account.id}" ${account.id === signedIn?.id ? "selected" : ""}>${esc(account.name)} · ${roles[account.uiRole]}</option>`,
          )
          .join("")}</select></label>`;
  return `<header class="topbar"><a class="top-brand" href="${pageUrl(state.role, "login")}">運動員營養管理平台</a><div class="top-actions"><small class="prototype-label">前端流程示意 · 範例資料</small>${switcher}</div></header>`;
}
