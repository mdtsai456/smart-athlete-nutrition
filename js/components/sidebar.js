/**
 * 側欄只決定顯示哪些分頁。
 * 後端檢查權限。
 */
import { esc, icon, roles } from "./ui.js";
import { pageUrl } from "../core/router.js";
const navigation = [
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
    return ["dashboard", "camera", "records"].includes(id);
  });
}
const roleLabels = {
  player: {
    dashboard: "球員首頁",
    camera: "食物攝影機",
    records: "我的飲食紀錄",
  },
  coach: { dashboard: "球員飲食監督" },
  nutritionist: { targets: "每日營養目標" },
};
export function sidebar(state) {
  if (state.route === "login") return "";
  const nav = allowed(state.role);
  const link = (id, label, glyph) =>
    `<a href="${pageUrl(state.role, id)}" class="nav-item ${state.route === id ? "active" : ""}" ${state.route === id ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${label}</span></a>`;
  const signedIn = state.data?.account;
  const links = nav.map(([id, glyph, label]) => link(id, roleLabels[state.role]?.[id] || label, glyph)).join("");
  const profile = `<div class="sidebar-bottom"><button class="help-btn" data-action="help">${icon("help")} 使用指南</button><div class="profile"><div><strong>${esc(signedIn?.name || "")}</strong><small>${roles[state.role]} · ${esc(signedIn?.organizationName || "")}</small></div></div></div>`;
  return `<aside class="sidebar"><p class="nav-caption">${roles[state.role]}介面</p><nav>${links}</nav>${profile}</aside>`;
}
