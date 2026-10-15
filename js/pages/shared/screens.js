/**
 * 依角色與路徑產生頁面。
 * 飲食紀錄與營養分析由三個角色共用。
 */
import { MEAL_TYPES } from "../../services/meal.service.js";
import { mealImage } from "../../components/meal-image.js";
import { analysisView } from "./analysis.js";
import { profileView } from "./profile.js";
import { cameraView } from "./camera.js";
import { mealHasItems } from "../../services/dashboard.service.js";
import { foodEmoji, foodImageUrl } from "../../utils/food-emoji.js";
import { coachDashboard, playerDashboard } from "./workflows.js";
import {
  icon,
  badge,
  avatar,
  esc,
  empty,
  button,
  shown,
} from "../../components/ui.js";
function foodAmount(value) {
  return value == null ? "未設定" : `${shown(value)} g`;
}
function foodCard(food) {
  const calories =
    food.calories == null ? "未設定" : `${shown(food.calories)} <small>kcal / 100g</small>`;
  const url = foodImageUrl(food);
  const mark = url
    ? `<img class="food-photo" src="${esc(url)}" alt="${esc(food.name)}">`
    : foodEmoji(food);
  return `<article class="food-card"><button type="button" class="food-delete" data-action="delete-food" data-id="${esc(food.id)}" aria-label="刪除${esc(food.name)}">刪除</button><div class="food-emoji">${mark}</div><div class="food-copy">${badge(food.category || "未分類", "neutral")}<h3>${esc(food.name)}</h3><strong>${calories}</strong><p>蛋白質 ${foodAmount(food.protein)} · 碳水 ${foodAmount(food.carbs)} · 脂肪 ${foodAmount(food.fat)}</p></div></article>`;
}
function recordFoods(record) {
  if (record.foodNames) return record.foodNames;
  const rejected = (record.items || []).filter(
    (item) => item.confirmationStatus === "rejected",
  );
  if (!rejected.length) return "";
  return `${rejected
    .map((item) => item.name)
    .filter(Boolean)
    .join("、")}（已拒絕）`;
}
/** 飲食紀錄略過沒有項目的草稿。較晚的紀錄在上面。 */
export function view(route, d, role, state = {}) {
  const filter = state.filter || "";
  if (route === "dashboard" && role === "coach")
    return coachDashboard(d, state.comparisonPlayer);
  if (route === "dashboard" && role === "player") return playerDashboard(d);
  if (route === "profile" && role === "player") return profileView(d);
  if (route === "targets") return '<div id="targets-root"></div>';
  if (route === "foods")
    return `<section class="panel"><div class="panel-heading"><div><h2>所有菜色 <span class="count">${d.foods.length}</span></h2><p>食物主檔不含營養數值，每 100 g 來自營養素列</p></div><div class="heading-actions">${button("匯入 Excel", "import-food")}${button(icon("plus") + " 新增菜色", "new-food", true)}</div></div><div class="toolbar"><label class="search">${icon("search")}<input id="search" placeholder="搜尋菜色名稱" value="${esc(filter)}"></label></div><div class="food-grid">${
      d.foods
        .filter((f) => f.name.includes(filter))
        .map(
          (f) =>
            foodCard(f),
        )
        .join("") || empty("找不到符合的菜色")
    }</div></section>`;
  if (route === "camera") return cameraView(d);
  if (route === "records") {
    // 營養師與教練使用清單篩選。球員只看自己的紀錄。
    const canFilter = role === "nutritionist" || role === "coach";
    const playerFilter = canFilter ? state.recordPlayer || "" : "";
    const mealFilters = canFilter ? state.recordMeals || [] : [];
    // 【新增 1. 篩選重設與無資料提示】是否有套用球員或餐別篩選，
    // 用來決定要不要顯示「清除篩選」按鈕。
    const hasFilter = Boolean(playerFilter || mealFilters.length);
    // 【新增 1. 篩選重設與無資料提示】先取出「所選日期的全部紀錄」（尚未套用球員與餐別篩選）。
    // 原本日期與篩選寫在同一個 filter，無法分辨「當日本來就沒紀錄」與「被篩選掉」。
    const dayRecords = d.records.filter(
      (r) =>
        (r.status !== "draft" || r.reason) &&
        mealHasItems(r) &&
        (role !== "player" || r.playerId === (d.athleteId || "p1")) &&
        r.date === d.date,
    );
    
    // 紀錄須同時符合日期、球員及餐別條件。多選餐別時，符合其中一項即可。
    // 【修改】改為從 dayRecords 再套用球員與餐別篩選，其餘條件不變。
    const records = dayRecords
      .filter(
        (r) =>
        //   (r.status !== "draft" || r.reason) &&
        //   mealHasItems(r) &&
        //   (role !== "player" || r.playerId === (d.athleteId || "p1")) &&
        //   r.date === d.date &&
          (!playerFilter || r.playerId === playerFilter) &&
          (!mealFilters.length || mealFilters.includes(r.meal)),
      )
      .sort(
        (a, b) =>
          (b.at || "").localeCompare(a.at || "") ||
          (b.createdAt || "").localeCompare(a.createdAt || ""),
      );
    // 待審核筆數只計算目前篩選結果。
    const waiting = records.filter((r) => r.status === "submitted").length;
    const reviewHint =
      role === "nutritionist"
        ? waiting
          ? `目前顯示 ${waiting} 筆待審核。已送出可修正食物、份量、拒絕或刪除；已審核要先重新開啟。較晚的紀錄在上面。`
          : "已審核的餐點可重新開啟後再修正。較晚的紀錄在上面。"
        : "較晚的紀錄在上面。";
        
   // 【新增 1. 篩選重設與無資料提示】「清除篩選」按鈕。
    // 點擊後由 app-shell.js 的 action("clear-record-filters") 重設球員與餐別，日期不變。
    const clearBtn = `<button type="button" class="btn" data-action="clear-record-filters">清除篩選</button>`;
    const filters = canFilter ? `<div class="record-filters"><label class="record-player-filter" for="record-player">球員<select id="record-player"><option value="">全部球員</option>${(d.players || []).map((p) => `<option value="${esc(p.id)}" ${p.id === playerFilter ? "selected" : ""}>${esc(p.name)}${p.number != null ? ` #${esc(p.number)}` : ""}</option>`).join("")}</select></label><fieldset class="record-meal-filters"><legend>餐別（可複選，未勾選時顯示全部）</legend>${MEAL_TYPES.map(([, label]) => `<label><input type="checkbox" name="record-meal" value="${esc(label)}" ${mealFilters.includes(label) ? "checked" : ""}>${label}</label>`).join("")}</fieldset><span class="muted" role="status">共 ${records.length} 筆</span>${hasFilter ? clearBtn : ""}</div>` : "";
    // 【修改】篩選列在有套用篩選時，於筆數後面顯示「清除篩選」。
    // 【新增 1. 篩選重設與無資料提示】依目前狀況區分兩種無資料提示：
    // 1. 當日完全沒有紀錄 → 「這一天還沒有飲食紀錄」
    // 2. 當日有紀錄但篩選後沒有結果 → 「沒有符合篩選條件…」並附清除按鈕
    const emptyState = !dayRecords.length
      ? empty("這一天還沒有飲食紀錄")
      : empty("沒有符合篩選條件的飲食紀錄，請調整球員或餐別。") +
        `<div class="empty-actions">${clearBtn}</div>`;
    const tone = (record) =>
      record.status === "reviewed" ? "green" : record.reason && record.status === "draft" ? "orange" : "neutral";
    return `<section class="panel"><div class="panel-heading"><div><h2>每日飲食紀錄</h2><p>${reviewHint}</p></div>${role === "player" ? button("＋ 新增紀錄", "record", true) : ""}</div>${filters}${records.length ? `<div class="table-wrap"><table><thead><tr><th>球員</th><th>餐別 / 時間</th><th>餐點內容</th><th>熱量</th><th>狀態</th><th></th></tr></thead><tbody>${records.map((r) => `<tr><td><div class="person">${avatar(r.player)}<strong>${esc(r.player.name)}</strong></div></td><td>${r.meal}<small>${r.date} ${r.time}</small></td><td class="food-names"><div class="meal-record-food">${mealImage(r.image, { compact: true })}<span>${esc(recordFoods(r))}</span></div></td><td><strong>${shown(r.nutrition.calories)}</strong> kcal</td><td>${badge(r.statusLabel, tone(r))}${r.reason ? `<small>${esc(r.reason)}</small>` : ""}${r.analysis ? `<small>${esc(r.analysis.statusLabel)}</small>` : ""}</td><td><span class="item-actions">${role === "nutritionist" && r.status === "submitted" ? `<button type="button" class="btn" data-action="correct-meal" data-id="${esc(r.id)}">修正</button><button type="button" class="btn primary" data-action="review-meal" data-id="${esc(r.id)}">審核通過</button>` : ""}${role === "nutritionist" && r.status === "reviewed" ? `<button type="button" class="btn" data-action="reopen-meal" data-id="${esc(r.id)}">重新開啟</button>` : ""}<button class="icon-btn" data-action="record-detail" data-id="${esc(r.id)}" aria-label="查看紀錄">${icon("chevron")}</button></span></td></tr>`).join("")}</tbody></table></div>` : emptyState}</section>`;
  }
  if (route === "analysis") return analysisView(d, role, state);
  if (route === "kiosk")
    return `<section class="panel kiosk"><div class="kiosk-symbol">${icon("camera")}</div><h2>放上餐盤，開始您的營養紀錄</h2><p>現場設備尚未串接，此處提供操作流程示範。</p><div class="kiosk-players">${d.players.map((p) => `<button data-action="kiosk-player" data-id="${p.id}">${avatar(p)}<strong>${esc(p.name)}</strong><small>#${p.number}</small></button>`).join("")}</div></section>`;
  return empty();
}
