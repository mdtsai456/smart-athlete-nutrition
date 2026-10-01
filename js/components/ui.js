/**
 * 基礎 UI 元件
 * 提供文字跳脫、圖示、頭像、狀態標籤、進度條、按鈕與球員表格，統一各頁共用的畫面元素。
 */
export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 21v-2a4 4 0 0 0-3-3.87 M16 3a4 4 0 0 1 0 8",
  food: "M4 3v7a3 3 0 0 0 6 0V3 M7 3v19 M20 22V3c-5 2-5 10 0 10",
  menu: "M5 4h14v18H5z M9 2h6v4H9z M9 11h6 M9 16h6",
  target:
    "M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9 M12 7a5 5 0 1 0 5 5 5 5 0 0 0-5-5 M12 11v2",
  chart: "M4 3v18h17 M8 16v-5 M13 16V7 M18 16v-8",
  camera: "M3 6h4l2-3h6l2 3h4v15H3z M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  chevron: "m9 5 7 7-7 7",
  bell: "M18 8a6 6 0 0 0-12 0v7l-2 3h16l-2-3z M10 21h4",
  calendar: "M3 5h18v16H3z M7 2v6 M17 2v6 M3 11h18",
  leaf: "M20 3C8 2 2 7 5 15s17 4 15-12z M5 20l10-12",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M9 9c0-4 7-3 6 0-1 2-3 1-3 5 M12 17h.01",
  plus: "M12 5v14 M5 12h14",
  check: "m5 12 4 4L19 6",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6",
  exit: "M9 3H3v18h6 M9 12h12 M17 8l4 4-4 4",
  fire: "M12 2c2 6-4 6-2 10 2-1 3-3 3-3s6 5 5 9-11 6-12-1C5 11 10 8 12 2",
};
export const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.grid}"/></svg>`;
export const badge = (text, tone = "green") =>
  `<span class="badge ${tone}"><i></i>${esc(text)}</span>`;
export const avatar = (p) =>
  `<span class="avatar color-${Number(p.id.replace(/\D/g, "")) % 4}">${esc(p.name.slice(-2))}</span>`;
export const progress = (value, tone = "green") =>
  `<span class="progress"><span class="${tone}" style="width:${Math.min(100, Math.max(0, value))}%"></span></span>`;
export const empty = (text = "目前沒有資料") =>
  `<div class="empty">${icon("menu")}<h3>${text}</h3><p>新增資料後，就會顯示在這裡。</p></div>`;
export const button = (label, action, primary = false) =>
  `<button type="button" class="btn ${primary ? "primary" : ""}" data-action="${action}">${label}</button>`;
export function playerTable(players, editable = false) {
  return `<div class="table-wrap"><table><thead><tr><th>球員</th><th>位置</th><th>三餐記錄率</th><th>熱量達成率</th><th>蛋白質攝取</th><th>營養狀態</th><th></th></tr></thead><tbody>${players.map((p) => `<tr><td><div class="person">${avatar(p)}<div><strong>${esc(p.name)}</strong><small>#${p.number} · 男子籃球隊</small></div></div></td><td>${p.position}</td><td><div class="meter">${progress(p.completion)}<span>${p.completion}%</span></div></td><td><strong>${p.rate}%</strong><small>${p.totals.calories.toLocaleString()} / ${p.target.calories.toLocaleString()} kcal</small></td><td><strong>${p.totals.protein}</strong><span class="muted"> / ${p.target.protein} g</span></td><td>${badge(p.status, p.tone)}</td><td><button class="icon-btn" data-action="${editable ? "target" : "detail"}" data-id="${p.id}" aria-label="查看 ${esc(p.name)}">${icon("chevron")}</button></td></tr>`).join("")}</tbody></table></div>`;
}
