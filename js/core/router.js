/**
 * 頁面網址。
 * 登入、運動員、營養師、教練各使用一個資料夾。
 * 每個分頁是一個 html 檔。
 */
const FOLDER = { player: "athlete", nutritionist: "nutritionist", coach: "coach" };
const ROLE = { athlete: "player", nutritionist: "nutritionist", coach: "coach" };
export function homeRoute(role) {
  return role === "nutritionist" ? "targets" : "dashboard";
}
export function pageUrl(role, route) {
  if (route === "login") return "/login/index.html";
  if (route === "kiosk") return "/kiosk/index.html";
  return `/${FOLDER[role]}/${route}.html`;
}
export function parsePath(pathname, fallbackRole = "nutritionist") {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "login") return { role: fallbackRole, route: "login" };
  if (parts[0] === "kiosk") return { role: fallbackRole, route: "kiosk" };
  const role = ROLE[parts[0]];
  if (!role) return { role: fallbackRole, route: "missing" };
  const file = (parts[1] || "index.html").replace(/\.html$/, "");
  return { role, route: file === "index" ? homeRoute(role) : file };
}
