import { icon, esc } from "./ui.js";
import { roles } from "../services/platform.js";
import { allowed, pageHeader, view } from "../pages/views.js";
import { loginView } from "../pages/workflows.js";

/** Shared application frame. Data loading and event handling remain in app.js. */
export function shell(state) {
  if (state.route === "kiosk") return stationShell(state);
  const isLogin = state.route === "login";
  const nav = allowed(state.role);
  const roleLabels = {
    player: {
      dashboard: "球員首頁",
      camera: "食物攝影機",
      records: "我的飲食紀錄",
      analysis: "個人營養狀況",
    },
    coach: {
      dashboard: "教練球員監督",
    },
    nutritionist: { targets: "每日營養目標" },
  };
  const link = (id, label, glyph) =>
    `<a href="#${id}" class="nav-item ${state.route === id ? "active" : ""}" ${state.route === id ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${label}</span></a>`;
  return `<header class="topbar"><a class="top-brand" href="#login">運動員營養管理平台</a><div class="top-actions"><small class="prototype-label">前端流程示意 · 範例資料</small>${
    !isLogin
      ? `<label class="role-switch"><select id="role" aria-label="切換角色">${Object.entries(
          roles,
        )
          .map(
            ([value, label]) =>
              `<option value="${value}" ${value === state.role ? "selected" : ""}>${label}視角</option>`,
          )
          .join("")}</select></label>`
      : ""
  }</div></header>
    <aside class="sidebar"><p class="nav-caption">${isLogin ? "頁面預覽" : roles[state.role] + "介面"}</p><nav>${link("login", "登入頁", "exit")}${isLogin ? `<button class="nav-item" data-action="preview-nutritionist">${icon("menu")}<span>每日營養目標</span></button><button class="nav-item" data-action="preview-player">${icon("users")}<span>球員首頁</span></button><button class="nav-item" data-action="preview-coach">${icon("chart")}<span>教練球員監督</span></button>` : nav.map(([id, glyph, label]) => link(id, roleLabels[state.role]?.[id] || label, glyph)).join("")}${isLogin ? link("kiosk", "現場餐秤站（設備）", "camera") : ""}</nav>${!isLogin ? `<div class="sidebar-bottom"><button class="help-btn" data-action="help">${icon("help")} 使用指南</button><div class="profile"><div><strong>${state.role === "player" ? "陳柏宇" : state.role === "coach" ? "林志遠" : "林怡安"}</strong><small>${roles[state.role]} · 示範帳號</small></div></div></div>` : ""}</aside>
    <div class="main-shell"><main class="${isLogin ? "login-main" : ""}">${isLogin ? loginView(state.role) : `${pageHeader(state.route, state.role, state.data.players.find(p => p.id === "p1"))}<div class="context-bar" ${state.route === "profile" ? "hidden" : ""}><span class="team-pill">男子籃球隊 · 2026–2027 賽季</span><label class="date-control">${icon("calendar")}<input type="date" id="date" aria-label="檢視日期" value="${esc(state.date)}"></label></div><div id="page">${view(state.route, state.data, state.role, state.filter, state)}</div><footer>此版本使用範例資料，尚未連接 AI 模型與現場設備。</footer>`}</main></div>`;
}

/** Shared station is a device workflow, independent from the three role workspaces. */
function stationShell(state) {
  return `<header class="topbar"><a class="top-brand" href="#login">營養餐秤站</a><a class="station-exit" href="#login">返回登入頁</a></header><div class="main-shell station-shell"><main><div class="page-heading"><div><h1>現場餐秤站</h1><p>請放上餐盤並選擇您的名字</p></div><span class="role-tag">共用設備模式</span></div><div class="context-bar" ${state.route === "profile" ? "hidden" : ""}><span class="team-pill">男子籃球隊</span><label class="date-control">${icon("calendar")}<input type="date" id="date" aria-label="紀錄日期" value="${esc(state.date)}"></label></div><div id="page">${view("kiosk", state.data, state.role)}</div><footer>現場流程示範 · 攝影機、餐秤與 AI 尚未串接。</footer></main></div>`;
}
