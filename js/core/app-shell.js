/**
 * 載入頁面資料、導覽與對話框。
 * 此模組處理攝影機、菜色匯入與餐點修正的按鈕事件。
 */
import { analyzePhoto } from "../services/recognition.service.js";
import { validatePhoto } from "../api/recognition.api.js";
import { config } from "../api/api.js";
import { capturePlatePhoto } from "../pages/shared/camera.js";
import { mealImage } from "../components/meal-image.js";
import { athleteDetails } from "../components/athlete-card.js";
import { header, pageHeader } from "../components/header.js";
import { closeDialog as closeModal, modal } from "../components/modal.js";
import { allowed, sidebar } from "../components/sidebar.js";
import { toast } from "../components/toast.js?v=20261029-dialog";
import { badge, button, esc, icon, percent, shown } from "../components/ui.js";
import {
  addMealItem,
  attachMealImage,
  confirmMealItem,
  deleteMealItem,
  openDraftMeal,
  queueMealAnalysis,
  finishMealAnalysis,
  readMeal,
  rejectMealItem,
  reopenMeal,
  reviewMeal,
  submitMeal,
} from "../api/meal.api.js";
import { FOOD_CATEGORIES } from "../utils/food-emoji.js";
import { NUTRIENT_LABEL, blankResult, previewFoodImport } from "../utils/food-import.js?v=20261029";
import { MAX_ITEM_GRAMS, MEAL_TYPES } from "../services/meal.service.js";
import { xlsxToRows } from "../utils/xlsx.js?v=20261029";
import { addFood, deleteFood, importFoods } from "../services/food.service.js";
import { updateMyProfile } from "../services/athlete.service.js";
import { validateForm, showFormErrors } from "../components/form-errors.js";

import { releaseExtraCamera, startPlateCamera, stopPlateCamera } from "../pages/shared/camera.js";
import { loadPage, today } from "../services/workspace.service.js";
import { enterAccount } from "./auth.js";
import { currentSession } from "../api/session.js";
import { homeRoute, pageUrl } from "./router.js";
import { state } from "./state.js";
let currentPage = null;
let loadVersion = 0;
let kioskTimer = null;
let recordDraft = null;
let foodImport = null;
const app = () => document.querySelector("#app");
// 各頁是獨立 HTML，重新載入後記憶體中的 state 會消失，所以篩選另外存。
// 一起記下帳號 id。帳號不同就不沿用舊篩選。
const RECORD_FILTER_KEY = "recordFilters";
let recordFilterOwner = null;
const EMPTY_RECORD_FILTERS = { player: "", meals: [] };
function loadRecordFilters(ownerId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(RECORD_FILTER_KEY) || "null");
    // 沒有登入、沒有存過、或帳號不同（切換帳號、登出後再登入）：清除舊篩選。
    if (!saved || !ownerId || saved.owner !== ownerId) {
      sessionStorage.removeItem(RECORD_FILTER_KEY);
      return { ...EMPTY_RECORD_FILTERS };
    }
    return {
      player: typeof saved.player === "string" ? saved.player : "",
      // 只保留仍存在的餐別名稱，避免舊資料或被改動的內容讓篩選失效。
      meals: Array.isArray(saved.meals)
        ? saved.meals.filter((meal) => MEAL_TYPES.some(([, label]) => label === meal))
        : [],
    };
  } catch {
    return { ...EMPTY_RECORD_FILTERS };
  }
}
function saveRecordFilters() {
  try {
    const meals = state.recordMeals || [];
    // 兩項都沒有選就不留資料。
    if (!state.recordPlayer && !meals.length) {
      sessionStorage.removeItem(RECORD_FILTER_KEY);
      return;
    }
    sessionStorage.setItem(
      RECORD_FILTER_KEY,
      JSON.stringify({ owner: recordFilterOwner, player: state.recordPlayer || "", meals }),
    );
  } catch {
    // 瀏覽器不允許儲存時，篩選仍可在目前頁面使用，只是不會保留。
  }
}
function closeDialog() {
  clearTimeout(kioskTimer);
  releaseRecordPhoto();
  recordDraft = null;
  releaseExtraCamera();
  closeModal();
}
function paintPage() {
  const page = document.querySelector("#page");
  if (!page || !state.data || !currentPage) return;
  page.innerHTML = currentPage.render(state);
  currentPage.mount?.(state);
}
function layout() {
  if (state.route === "kiosk") {
    return `<header class="topbar"><a class="top-brand" href="${pageUrl(state.role, "login")}">營養餐秤站</a><a class="station-exit" href="${pageUrl(state.role, "login")}">返回登入頁</a></header><div class="main-shell station-shell"><main><div class="page-heading"><div><h1>現場餐秤站</h1><p>請放上餐盤並選擇您的名字</p></div><span class="role-tag">共用設備模式</span></div><div class="context-bar"><span class="team-pill">男子籃球隊</span><label class="date-control">${icon("calendar")}<input type="date" id="date" aria-label="紀錄日期" value="${esc(state.date)}"></label></div><div id="page">${currentPage.render(state)}</div><footer>餐點資料暫存於本機；餐秤尚未串接。</footer></main></div>`;
  }
  const isLogin = state.route === "login";
  const player =
    state.data.players.find((item) => item.id === (state.data.athleteId || "p1")) ||
    state.data.players[0];
  const main = isLogin
    ? currentPage.render(state)
    : `${pageHeader(state.route, state.role, player)}<div class="context-bar" ${state.route === "profile" ? "hidden" : ""}><span class="team-pill">${esc(state.data.organizationName || "男子籃球隊")} · 2026–2027 賽季</span><label class="date-control">${icon("calendar")}<input type="date" id="date" aria-label="檢視日期" value="${esc(state.date)}"></label></div><div id="page">${currentPage.render(state)}</div><footer>餐點資料暫存於本機；照片辨識使用外部 API，重量須自行確認。</footer>`;
  return `${header(state)}${isLogin ? "" : sidebar(state)}<div class="main-shell${isLogin ? " login-shell" : ""}"><main class="${isLogin ? "login-main" : ""}">${main}</main></div>`;
}
async function render() {
  const token = ++loadVersion;
  const root = app();
  root.setAttribute("aria-busy", "true");
  try {
    const session = await currentSession().catch((error) => {
      if (error.status === 401) return null;
      throw error;
    });
    const data = await loadPage(state.date, session?.id || null);
    if (token !== loadVersion) return;
    if (
      data.account &&
      !["login", "kiosk"].includes(state.route) &&
      data.account.role !== state.role
    ) {
      location.replace(pageUrl(data.account.role, homeRoute(data.account.role)));
      return;
    }
    if (data.account && !data.players.some((player) => player.id === state.comparisonPlayer))
      state.comparisonPlayer = data.players[0]?.id || "";
    if (state.recordPlayer && !(data.players || []).some((p) => p.id === state.recordPlayer)) {
      state.recordPlayer = "";
      saveRecordFilters();
    }
    state.data = data;
    root.innerHTML = layout();
    currentPage.mount?.(state);
  } catch (error) {
    root.innerHTML = `<div class="error-page"><h1>暫時無法載入資料</h1><p>${esc(error.message)}</p>${button("重新載入", "retry", true)}</div>`;
  } finally {
    if (token === loadVersion) root.removeAttribute("aria-busy");
  }
}
const input = (label, name, type = "text", value = "", extra = "") =>
  `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra} required></label>`;
const select = (label, name, options) =>
  `<label class="field">${label}<select name="${name}">${options}</select></label>`;
function mealPicker(selected, formId = "") {
  const form = formId ? ` form="${esc(formId)}"` : "";
  const options = MEAL_TYPES.map(
    ([value, label]) =>
      `<label class="meal-option"><input type="radio" name="meal" value="${esc(value)}"${form}${value === selected ? " checked" : ""}><span>${esc(label)}</span></label>`,
  ).join("");
  return `<fieldset class="meal-picker"><legend>餐別</legend><div class="meal-options">${options}</div></fieldset>`;
}
const form = (type, body, submit = "儲存") =>
  `<form data-form="${type}">${body}<div class="form-error" role="alert"></div><div class="modal-footer">${button("取消", "close")}<button class="btn primary" type="submit">${submit}</button></div></form>`;
function nutrientText(amounts) {
  return Object.entries(amounts)
    .map(
      ([id, value]) =>
        `${NUTRIENT_LABEL[id]} ${shown(value)} ${id === "energy" ? "kcal" : "g"}`,
    )
    .join("、");
}
function foodImportTable(title, rows, errorColumn) {
  if (!rows.length) return "";
  const body = rows
    .map(
      (row) =>
        `<tr><td>${row.row}</td><td>${esc(row.name || "（空白）")}</td><td>${esc(row.foodType || "未分類")}</td><td>${esc(nutrientText(row.amounts) || "沒有營養數字")}</td>${errorColumn ? `<td class="import-reason">${esc(row.reasons.join("；"))}</td>` : ""}</tr>`,
    )
    .join("");
  return `<h3>${title}</h3><table${errorColumn ? ` class="with-reason"` : ""}><thead><tr><th>列</th><th>菜色</th><th>分類</th><th>每 100 g</th>${errorColumn ? "<th>原因</th>" : ""}</tr></thead><tbody>${body}</tbody></table>`;
}
function foodImportBody(result) {
  const problem = result?.fileError
    ? `<p class="import-error">${esc(result.fileError)}</p>`
    : "";
  const ignored = result?.ignoredColumns?.length
    ? `<p>未對應的欄位：${esc(result.ignoredColumns.join("、"))}。這些欄不寫入。</p>`
    : "";
  const tables = result
    ? `${foodImportTable(`可寫入 ${result.ready.length} 列`, result.ready, false)}${foodImportTable(`不寫入 ${result.rejected.length} 列`, result.rejected, true)}`
    : "";
  const confirm = result?.ready?.length
    ? `<div class="import-actions">${button("確認寫入", "confirm-food-import", true)}</div>`
    : "";
  return `<div class="import-preview"><p>選擇 .xlsx。標題可以用中文或英文。空白的選填欄會略過。有圖示欄時用該格的圖，沒有就依菜名。確認後只寫入可寫入的列。</p><label class="field">Excel 檔案<input id="food-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>${problem}${ignored}${tables}</div>${confirm}`;
}
function showImportDialog(title, body) {
  modal(title, body, true);
  document.querySelector("#dialog").classList.add("import-dialog");
}
function openFoodImport() {
  foodImport = null;
  showImportDialog("匯入菜色", foodImportBody(null));
}
async function readFoodFile(file) {
  if (!file) return;
  try {
    const rows = await xlsxToRows(new Uint8Array(await file.arrayBuffer()));
    if (!rows.length) throw new Error(`「${file.name}」的第一個工作表沒有讀到資料，請確認菜單位於第一個工作表。`);
    foodImport = previewFoodImport(
      rows,
      (state.data?.foods || []).map((food) => food.name),
    );
  } catch (error) {
    foodImport = blankResult(error.message);
  }
  showImportDialog("匯入菜色", foodImportBody(foodImport));
}
async function confirmFoodImport() {
  if (state.role !== "nutritionist") throw new Error("只有營養師可以匯入菜色");
  if (!foodImport?.ready.length) throw new Error("沒有可寫入的列");
  const result = await importFoods(foodImport.ready);
  foodImport = null;
  await render();
  if (!result.failed.length) {
    closeDialog();
    toast(`已新增 ${result.written.length} 道菜`);
    return;
  }
  showImportDialog(
    "匯入結果",
    `<div class="import-preview"><p>已寫入 ${result.written.length} 道菜。下面的列沒有寫入。</p>${foodImportTable("沒有寫入", result.failed, true)}</div>`,
  );
}
function foodOptions(selectedId) {
  const foods = state.data?.foods || [];
  const options = foods.map(
    (food) =>
      `<option value="${esc(food.id)}"${food.id === selectedId ? " selected" : ""}>${esc(food.name)}</option>`,
  );
  if (selectedId && !foods.some((food) => food.id === selectedId))
    options.unshift(`<option value="${esc(selectedId)}" selected>尚未對應</option>`);
  return options.join("");
}
async function openCorrection(mealId) {
  if (state.role !== "nutritionist") throw new Error("只有營養師可以修正已送出的餐");
  const view = await readMeal(mealId);
  if (view.status !== "submitted") throw new Error("只有已送出的餐可以修正。已審核請先重新開啟。");
  const player = state.data.players.find((item) => item.id === view.playerId);
  const itemForms = view.items
    .map(
      (item) => `<form data-form="correct-item" class="correction-item">
<input name="mealId" type="hidden" value="${esc(mealId)}">
<input name="itemId" type="hidden" value="${esc(item.id)}">
<input name="expectedRevision" type="hidden" value="${esc(view.revision)}">
<p><strong>${esc(item.name)}</strong> · ${esc(item.confirmationLabel)} · ${item.grams == null ? "—" : shown(item.grams)} g</p>
<label class="field">食物<select name="foodId">${foodOptions(item.foodId)}</select></label>
<label class="field">重量（g）<input name="weightG" type="number" min="0.1" max="${MAX_ITEM_GRAMS}" step="0.1" value="${esc(item.grams ?? "")}" required></label>
<label class="field">修正原因<textarea name="reason" rows="2" required placeholder="請寫明這項要改什麼"></textarea></label>
<div class="actions"><button class="btn primary" type="submit" name="intent" value="save">儲存這項</button><button class="btn" type="submit" name="intent" value="reject">拒絕這項</button><button class="btn" type="submit" name="intent" value="delete">刪除這項</button></div>
<div class="form-error" role="alert"></div>
</form>`,
    )
    .join("");
  modal(
    `${esc(player?.name || "餐點")} · 修正${esc(view.meal)}`,
    `<div class="correction"><p>這筆餐已送出。改食物、份量、拒絕或刪除都要寫原因，改完再審核。拒絕與刪除的項目不計入攝取。</p>${view.reason ? `<p>重新開啟原因：${esc(view.reason)}</p>` : ""}${itemForms}<form data-form="correct-add"><input name="mealId" type="hidden" value="${esc(mealId)}"><input name="expectedRevision" type="hidden" value="${esc(view.revision)}"><h3>新增一項</h3><label class="field">食物<select name="foodId">${foodOptions("")}</select></label><label class="field">重量（g）<input name="weightG" type="number" min="0.1" max="${MAX_ITEM_GRAMS}" step="0.1" required></label><label class="field">修正原因<textarea name="reason" rows="2" required placeholder="請寫明為什麼要加這項"></textarea></label><div class="actions"><button class="btn primary" type="submit">新增並確認</button></div><div class="form-error" role="alert"></div></form><div class="notice">本餐熱量 ${shown(view.nutrition.calories)} kcal · 蛋白質 ${shown(view.nutrition.protein)} g · 碳水 ${shown(view.nutrition.carbs)} g · 脂肪 ${shown(view.nutrition.fat)} g</div><div class="actions"><button type="button" class="btn primary" data-action="review-meal" data-id="${esc(mealId)}">審核通過</button></div></div>`,
    true,
  );
}
function targetModal(id) {
  const player = state.data.players.find((item) => item.id === id);
  modal(
    `${esc(player.name)} · 運動員資料`,
    `<div class="guide">${athleteDetails(player)}<h3>當日營養狀況</h3><p>${state.date} · ${esc(player.position)}</p>${[
      ["calories", "熱量", "kcal"],
      ["protein", "蛋白質", "g"],
      ["carbs", "碳水", "g"],
      ["fat", "脂肪", "g"],
    ]
      .map(
        ([key, label, unit]) =>
          `<div class="data-row"><span>${label}</span><strong>${shown(player.totals[key])} / ${shown(player.target?.[key])} ${unit}</strong></div>`,
      )
      .join("")}</div>`,
  );
}
function releaseRecordPhoto() {
  recordDraft?.controller?.abort();
  if (recordDraft?.previewUrl) URL.revokeObjectURL(recordDraft.previewUrl);
}
function selectRecordPhoto(file) {
  validatePhoto(file);
  if (!recordDraft || recordDraft.recognizing) return;
  if (recordDraft.previewUrl) URL.revokeObjectURL(recordDraft.previewUrl);
  recordDraft.file = file;
  recordDraft.previewUrl = URL.createObjectURL(file);
  document.querySelector('[data-action="recognize-photo"]').disabled = false;
  document.querySelector('#recognition-note').textContent = '照片已準備好，請開始辨識。';
}
/** 拍照與檔案上傳共用辨識流程。餐點仍使用現有儲存與確認機制。 */
async function recognizeRecordPhoto() {
  const draft = recordDraft;
  if (!draft?.file || draft.recognizing) return;
  if (config.mode !== 'mock') throw new Error('餐點正式後端尚未提供辨識結果寫入介面。');
  draft.recognizing = true;
  draft.controller = new AbortController();
  const controls = document.querySelectorAll('#dialog .actions button, #plate-photo-file');
  controls.forEach(el => el.disabled = true);
  const note = document.querySelector('#recognition-note');
  note.textContent = '正在辨識照片，請稍候…';
  try {
    const outcome = await analyzePhoto(draft.file, state.data.foods, draft.controller.signal);
    if (recordDraft !== draft) return;
    if (!draft.mealId) {
      const meal = await openDraftMeal({ athleteId: draft.playerId, localDate: draft.date, mealType: draft.mealType });
      draft.mealId = meal.mealId;
      draft.revision = meal.revision;
    }
    if (recordDraft !== draft) return;
    const attached = await attachMealImage(draft.mealId, draft.revision, outcome.image || {});
    draft.revision = attached.revision;
    if (recordDraft !== draft) return;
    const queued = await queueMealAnalysis(draft.mealId, draft.revision);
    draft.revision = queued.revision;
    const finished = await finishMealAnalysis(draft.mealId, outcome);
    if (recordDraft !== draft) return;
    draft.revision = finished.revision;
    draft.stage = '辨識完成，請確認菜色並填寫重量';
    await renderRecord();
  } catch (error) {
    if (recordDraft === draft) note.textContent = error.message;
  } finally {
    draft.recognizing = false;
    controls.forEach(el => el.disabled = false);
  }
}
function recordStart(playerId = state.data?.athleteId || "p1", kiosk = false) {
  releaseRecordPhoto();
  recordDraft = {
    playerId,
    kiosk,
    date: state.date,
    mealId: null,
    mealType: "lunch",
    stage: "準備拍攝",
  };
  const player = state.data.players.find((item) => item.id === playerId);
  modal(
    "食物攝影機",
    `<div class="guide"><div class="plate-camera"><video id="dialog-plate-camera" autoplay playsinline muted></video><div class="plate-frame" aria-hidden="true"></div><p id="dialog-plate-note">正在開啟攝影機</p></div><p>${esc(player.name)} · ${state.date}</p>${mealPicker("lunch")}<p>拍攝餐盤或選取照片，再開始辨識。辨識後請確認菜色並填寫重量。</p><div class="actions">${button("拍攝照片", "capture-photo", true)}${button("選取照片", "select-photo")}<input type="file" id="plate-photo-file" accept="image/jpeg,image/png,image/webp" hidden><button type="button" class="btn primary" data-action="recognize-photo" disabled>開始辨識</button></div><p id="recognition-note" role="status">支援 JPG、PNG、WebP，最大 10 MB。</p></div>`,
    true,
  );
  document.querySelector("#dialog").classList.add("record-dialog");
  startPlateCamera(
    document.querySelector("#dialog-plate-camera"),
    document.querySelector("#dialog-plate-note"),
  );
}
/** 讀取餐點並更新畫面，不啟動分析。 */
async function renderRecord() {
  releaseExtraCamera();
  const draft = recordDraft;
  if (!draft) return;
  const view = await readMeal(draft.mealId);
  if (recordDraft !== draft) return;
  recordDraft.view = view;
  recordDraft.revision = view.revision;
  const selected = recordDraft.mealType || view.mealType || "lunch";
  const items = view.items
    .map((item) => {
      const selectedCandidate = draft.candidates?.[item.id] === 'alternative' ? item.alternative : item;
      const unmatched = item.confirmationStatus === "pending" && !selectedCandidate?.foodId;
      const candidates = item.alternative && item.confirmationStatus === "pending"
        ? `<fieldset class="recognition-candidates" aria-label="請選擇這份食物的菜色"><div class="recognition-candidate-options">${[['primary', item, '最佳'], ['alternative', item.alternative, '次佳']].map(([key, candidate, label]) => `<label><input type="radio" name="candidate-${esc(item.id)}" data-candidate-for="${esc(item.id)}" value="${key}" ${(draft.candidates?.[item.id] || 'primary') === key ? 'checked' : ''}><span><span class="candidate-name">${esc(candidate.detectedLabel || candidate.name)}</span><span class="candidate-rank">${label}</span>${candidate.foodId ? '' : '<span class="candidate-rank">尚未對應菜色</span>'}</span></label>`).join('')}</div></fieldset>` : '';
      const hint = unmatched ? `<span class="analysis-error-tag">尚未對應菜色</span> · ` : "";
      const choose = unmatched
        ? `<label class="field">菜色<select data-food-for="${esc(item.id)}"><option value="">請選擇菜色</option>${foodOptions("")}</select></label>`
        : "";
      const actions =
        item.confirmationStatus === "pending"
          ? `<span class="item-actions">${choose}<label class="field">重量（g）<input type="number" data-weight-for="${esc(item.id)}" value="${item.grams ?? ""}" min="0.1" max="${MAX_ITEM_GRAMS}" step="0.1" required></label><button type="button" class="btn" data-action="confirm-item" data-id="${esc(item.id)}">確認</button><button type="button" class="btn" data-action="reject-item" data-id="${esc(item.id)}">拒絕</button></span>`
          : "";
      return `<div class="data-row"><div>${candidates || `<strong>${esc(item.name)}</strong>`}<small>${esc(item.confirmationLabel)} · ${hint}${item.grams == null ? "—" : shown(item.grams)} g</small></div>${actions}</div>`;
    })
    .join("");
  const analysisNote =
    view.analysis?.status === "failed"
      ? view.analysis.errorMessage
      : view.analysis?.notice;
  const nutrition = view.nutrition;
  const manualAdd =
    view.analysis?.status === "succeeded"
      ? `<form data-form="draft-add"><h3>手動加一項</h3><label class="field">食物<select name="foodId" required><option value="">請選擇菜色</option>${foodOptions("")}</select></label><label class="field">重量（g）<input name="grams" type="number" min="0.1" max="${MAX_ITEM_GRAMS}" step="0.1" required></label><div class="actions"><button class="btn" type="submit">加入這項</button></div><div class="form-error" role="alert"></div></form>`
      : "";
  modal(
    "確認餐點與營養份量",
    `<div class="record-layout"><section><h3>餐盤影像</h3>${mealImage(view.image?.url ? view.image : { url: draft.previewUrl }, { annotated: true, items: view.items.map(item => ({ ...item, name: draft.candidates?.[item.id] === "alternative" ? item.alternative?.detectedLabel : item.name })) })}<p class="footnote">${esc(recordDraft.stage)} · ${esc(view.analysis?.statusLabel || "尚無分析")}</p></section><section><h3>餐點確認結果</h3>${mealPicker(selected, "record-form")}<div class="actions record-meal-actions">${view.items.some((item) => item.confirmationStatus === "pending" && item.foodId && item.grams > 0 && !item.alternative) ? button("全部確認", "confirm-all") : ""}${button("重新拍攝", "retake")}</div><p class="muted">待確認項目還不計入攝取。確認後才計入這一餐。送出時把這一版固定下來，不會另外重建項目。</p>${analysisNote ? `<p class="analysis-error">${esc(analysisNote)}</p>` : ""}<div id="record-items">${items}</div>${manualAdd}<form id="record-form" data-form="record"><div id="nutrition-preview" class="nutrition-preview" aria-live="polite"><div><strong>${shown(nutrition.calories)}</strong><span>kcal 已確認熱量</span></div><div><strong>${shown(nutrition.protein)} g</strong><span>蛋白質</span></div><div><strong>${shown(nutrition.carbs)} g</strong><span>碳水化合物</span></div><div><strong>${shown(nutrition.fat)} g</strong><span>脂肪</span></div></div><div class="form-error" role="alert"></div><div class="modal-footer">${button("取消", "close")}<button type="submit" class="btn primary" ${view.canSubmit ? "" : "disabled"}>${icon("check")} 送出餐點</button></div></form></section></div>`,
    true,
  );
  document.querySelector("#dialog").classList.add("record-dialog");
}
async function action(name, id) {
  if (currentPage?.onAction?.(name, id)) return;
  if (name === "close") return closeDialog();
  if (name === "retry") return render();
  // 清除飲食紀錄的球員與餐別篩選。只重設篩選，不動日期。
  if (name === "clear-record-filters") {
    state.recordPlayer = "";
    state.recordMeals = [];
    saveRecordFilters();
    paintPage();
    document.querySelector("#record-player")?.focus();
    return;
  }
  if (name === "help")
    return modal(
      "使用指南",
      `<div class="guide"><h3>01 選擇帳號</h3><p>從登入頁進入。停權帳號與停用組織不能登入。右上角只能切換到啟用中的帳號。</p><h3>02 規劃營養補給</h3><p>營養師看同組織全部球員。教練只看指派開始日到結束日之間的球員。</p><h3>03 記錄與追蹤</h3><p>球員透過食物攝影機記錄實際餐點。示範日期預設為 2026/11/16。</p></div>`,
    );
  if (name === "notifications")
    return modal(
      "今日提醒",
      `<div class="guide">${
        state.data.players
          .filter((player) => player.tone === "orange")
          .map(
            (player) =>
              `<p>${badge("待關注", "orange")} <strong>${esc(player.name)}</strong> 今日熱量達成 ${percent(player.rate)}，請確認飲食紀錄。</p>`,
          )
          .join("") || "<p>今天沒有待關注提醒。</p>"
      }</div>`,
    );
  if (name === "delete-food" && state.role === "nutritionist") {
    const food = state.data?.foods?.find((item) => item.id === id);
    if (!food) return;
    return modal(
      "刪除菜色",
      `<div class="guide"><p>要刪除「${esc(food.name)}」嗎？已用在飲食紀錄的菜不能刪除。</p><div class="modal-footer">${button("取消", "close")}<button type="button" class="btn primary" data-action="confirm-delete-food" data-id="${esc(id)}">刪除</button></div></div>`,
    );
  }
  if (name === "confirm-delete-food" && state.role === "nutritionist") {
    await deleteFood(id);
    closeDialog();
    await render();
    toast("已刪除這道菜");
    return;
  }
  if (name === "import-food" && state.role === "nutritionist") return openFoodImport();
  if (name === "confirm-food-import") return confirmFoodImport();
  if (name === "new-food" && state.role === "nutritionist")
    return modal(
      "新增菜色",
      form(
        "food",
        `${input("菜色名稱", "name")}${select("菜色分類", "category", FOOD_CATEGORIES.map(([item]) => `<option>${item}</option>`).join(""))}<p class="notice">食物主檔只存名稱與分類。下面的數字會存成每 100 g 的營養素列。</p><div class="form-grid">${[
          ["calories", "熱量（kcal）"],
          ["protein", "蛋白質（g）"],
          ["carbs", "碳水（g）"],
          ["fat", "脂肪（g）"],
        ]
          .map(([key, label]) => input(label, key, "number", "", 'min="0" max="1000" step="0.1"'))
          .join("")}</div>`,
      ),
    );
  if (name === "target" && state.role === "nutritionist") {
    sessionStorage.setItem("targetPlayer", id);
    location.assign(pageUrl("nutritionist", "targets"));
    return;
  }
  if (name === "range") {
    state.rangePreset = id || "7";
    sessionStorage.setItem("rangePreset", state.rangePreset);
    paintPage();
    return;
  }
  if (name === "detail") return targetModal(id);
  if (name === "record") return recordStart();
  if (name === "kiosk-player") return recordStart(id, true);
  if (name === "retake" && recordDraft) return recordStart(recordDraft.playerId, recordDraft.kiosk);
  if (name === "capture-photo") {
    const draft = recordDraft;
    const photo = await capturePlatePhoto(document.querySelector('#dialog-plate-camera'));
    if (recordDraft === draft) selectRecordPhoto(photo);
    return;
  }
  if (name === "select-photo") return document.querySelector('#plate-photo-file')?.click();
  if (name === "recognize-photo") return recognizeRecordPhoto();
  if (name === "confirm-item" && recordDraft) {
    const picked = document.querySelector(`[data-food-for="${CSS.escape(id)}"]`)?.value;
    const current = recordDraft.view?.items?.find((item) => item.id === id);
    const candidate = recordDraft.candidates?.[id] === "alternative" ? current?.alternative : current;
    if (!picked && !candidate?.foodId) {
      toast("請先選擇菜色");
      return;
    }
    // 先在欄位顯示重量錯誤，不讓提示落到對話框外。
    const weightInput = document.querySelector(`[data-weight-for="${CSS.escape(id)}"]`);
    if (!weightInput || !weightInput.reportValidity()) return;
    const confirmed = await confirmMealItem(recordDraft.mealId,
      id,
      { foodId: picked || candidate.foodId, weightG: Number(weightInput.value), weightSource: "manual" },
      recordDraft.revision,
    );
    recordDraft.revision = confirmed.revision;
    return renderRecord();
  }
  if (name === "reject-item" && recordDraft) {
    const rejected = await rejectMealItem(recordDraft.mealId, id, "", recordDraft.revision);
    recordDraft.revision = rejected.revision;
    return renderRecord();
  }
  if (name === "confirm-all" && recordDraft?.view) {
    let skipped = false;
    for (const item of recordDraft.view.items) {
      if (item.confirmationStatus !== "pending") continue;
      if (item.alternative || !item.foodId || !(item.grams > 0)) {
        skipped = true;
        continue;
      }
      const confirmed = await confirmMealItem(recordDraft.mealId, item.id, {}, recordDraft.revision);
      recordDraft.revision = confirmed.revision;
    }
    if (skipped) toast("有候選菜色、未對應菜色或缺少重量的項目，請逐項確認。");
    return renderRecord();
  }
  if (name === "record-detail") {
    const record = state.data.records.find((item) => item.id === id);
    return modal(
      `${esc(record.player.name)} · ${record.meal}`,
      `<div class="guide"><p>${record.date} ${record.time} · ${esc(record.statusLabel)}${record.analysis ? " · " + esc(record.analysis.statusLabel) : ""}</p>${record.reason ? `<p>重新開啟原因：${esc(record.reason)}</p>` : ""}${mealImage(record.image)}<p class="footnote">${record.image?.url ? "餐盤影像" : "範例預覽 · 實拍影像網址由後端提供"}</p>${record.items.map((item) => `<p>${esc(item.name)} <strong>${item.grams == null ? "—" : shown(item.grams)} g</strong> · ${esc(item.confirmationLabel)}</p>`).join("")}<div class="notice">熱量 ${shown(record.nutrition.calories)} kcal · 蛋白質 ${shown(record.nutrition.protein)} g · 碳水 ${shown(record.nutrition.carbs)} g · 脂肪 ${shown(record.nutrition.fat)} g</div>${state.role === "nutritionist" && record.status === "submitted" ? `<div class="actions"><button type="button" class="btn" data-action="correct-meal" data-id="${record.id}">修正餐點</button><button type="button" class="btn primary" data-action="review-meal" data-id="${record.id}">審核通過</button></div>` : ""}${state.role === "nutritionist" && record.status === "reviewed" ? `<div class="actions"><button type="button" class="btn" data-action="reopen-meal" data-id="${record.id}">重新開啟</button></div>` : ""}</div>`,
    );
  }
  if (name === "correct-meal" && state.role === "nutritionist") return openCorrection(id);
  if (name === "review-meal" && state.role === "nutritionist") {
    const record = state.data.records.find((item) => item.id === id);
    await reviewMeal(id, record?.revision);
    closeDialog();
    await render();
    toast("餐點已審核");
  }
  if (name === "reopen-meal" && state.role === "nutritionist") {
    const record = state.data.records.find((item) => item.id === id);
    return modal(
      "重新開啟",
      form(
        "reopen-meal",
        `<input name="mealId" type="hidden" value="${esc(id)}"><input name="expectedRevision" type="hidden" value="${esc(record?.revision ?? "")}"><label class="field">原因<textarea name="reason" rows="3" required placeholder="請寫明要修正的地方"></textarea></label>`,
        "回到已送出",
      ),
      true,
    );
  }
}
async function reportMealError(error) {
  if (error?.status === 409 && error?.code === "REVISION_CONFLICT") {
    toast("此餐點已被其他人更新，請重新載入。");
    if (recordDraft?.mealId) {
      await renderRecord();
      return;
    }
    closeDialog();
    await render();
    return;
  }
  toast(error.message);
}
function bindEvents() {
  if (bindEvents.ready) return;
  bindEvents.ready = true;
  // 圖片載入錯誤不會冒泡；框選圖失敗時只退回原圖一次。
  document.addEventListener("error", (event) => {
    const img = event.target;
    if (img instanceof HTMLImageElement && img.dataset.originalSrc) {
      const original = img.dataset.originalSrc;
      delete img.dataset.originalSrc;
      img.alt = "餐盤原圖（框選圖無法載入）";
      img.src = original;
    }
  }, true);
  document.addEventListener("click", (event) => {
    const el = event.target.closest("[data-action]");
    if (el) action(el.dataset.action, el.dataset.id).catch((error) => reportMealError(error));
  });
  document.addEventListener("change", async (event) => {
    if (event.target.dataset.candidateFor && recordDraft) {
      const id = event.target.dataset.candidateFor;
      recordDraft.candidates ||= {};
      recordDraft.candidates[id] = event.target.value;
      // 更新候選時保留各項尚未確認的重量。
      const weights = [...document.querySelectorAll('[data-weight-for]')].map(el => [el.dataset.weightFor, el.value]);
      await renderRecord();
      for (const [itemId, value] of weights) {
        const field = document.querySelector(`[data-weight-for="${CSS.escape(itemId)}"]`);
        if (field) field.value = value;
      }
      return;
    }
    if (event.target.id === 'plate-photo-file') {
      const file = event.target.files?.[0];
      if (file) {
        try { selectRecordPhoto(file); }
        catch (error) { document.querySelector('#recognition-note').textContent = error.message; }
      }
      event.target.value = '';
      return;
    }
    // 篩選已載入的紀錄，只更新頁面，不寫入餐點資料。
    if (event.target.id === "record-player" || event.target.name === "record-meal") {
      const target = event.target;
      if (target.id === "record-player") state.recordPlayer = target.value;
      else state.recordMeals = [...document.querySelectorAll('input[name="record-meal"]:checked')].map((el) => el.value);
      saveRecordFilters();
      paintPage();
      // 重繪後保留鍵盤焦點。
      const controls = document.querySelectorAll('#record-player, input[name="record-meal"]');
      [...controls].find((el) => el.id === target.id && el.value === target.value)?.focus();
    }
    if (event.target.name === "meal" && recordDraft) {
      recordDraft.mealType = event.target.value;
    }
    if (event.target.id === "comparison-player") {
      state.comparisonPlayer = event.target.value;
      sessionStorage.setItem("comparisonPlayer", state.comparisonPlayer);
      paintPage();
    }
    if (event.target.id === "account") enterAccount(event.target.value).catch((error) => toast(error.message));
    if (event.target.id === "food-file") await readFoodFile(event.target.files?.[0]);
    if (event.target.id === "range-start" || event.target.id === "range-end") {
      state.rangePreset = "custom";
      state.rangeStart = document.querySelector("#range-start").value;
      state.rangeEnd = document.querySelector("#range-end").value;
      sessionStorage.setItem("rangePreset", "custom");
      sessionStorage.setItem("rangeStart", state.rangeStart);
      sessionStorage.setItem("rangeEnd", state.rangeEnd);
      paintPage();
    }
    if (event.target.id === "date") {
      state.date = event.target.value || today;
      sessionStorage.setItem("viewDate", state.date);
      await render();
    }
  });
  document.addEventListener("input", (event) => {
    if (event.target.id !== "search") return;
    state.filter = event.target.value;
    const position = event.target.selectionStart;
    paintPage();
    const el = document.querySelector("#search");
    el.focus();
    el.setSelectionRange(position, position);
  });
  document.querySelector("#dialog").addEventListener("cancel", () => {
    clearTimeout(kioskTimer);
    releaseRecordPhoto();
    recordDraft = null;
    releaseExtraCamera();
  });
  document.addEventListener("submit", async (event) => {
    if (event.target.id === "demo-login") {
      event.preventDefault();
      const error = event.target.querySelector(".form-error");
      try {
        await enterAccount(new FormData(event.target).get("accountId"));
      } catch (err) {
        error.textContent = err.message;
      }
      return;
    }
    const formEl = event.target.closest("[data-form]");
    if (!formEl) return;
    event.preventDefault();
    const submit = formEl.querySelector('[type="submit"]');
    if (submit.disabled) return;
    // 有錯誤就停在欄位旁，不重畫表單，已填內容會留著。
    if (formEl.dataset.form === "my-profile") {
      if (showFormErrors(formEl, validateForm(formEl))) return;
    }

    submit.disabled = true;
    const submitter = event.submitter?.form === formEl ? event.submitter : null;
    const obj = Object.fromEntries(submitter ? new FormData(formEl, submitter) : new FormData(formEl));
    try {
      switch (formEl.dataset.form) {
        case "my-profile":
          if (state.role !== "player") throw new Error("請以球員身分更新個人資料");
          const session = await currentSession();
          await updateMyProfile(obj, session.id);
          await render();
          toast("個人資料已儲存，教練與營養師可查看更新");
          return;
        case "food":
          await addFood({
            ...obj,
            calories: +obj.calories,
            protein: +obj.protein,
            carbs: +obj.carbs,
            fat: +obj.fat,
          });
          break;
        case "draft-add": {
          if (!recordDraft?.mealId) throw new Error("請先拍攝");
          const added = await addMealItem(
            recordDraft.mealId,
            { foodId: obj.foodId, grams: Number(obj.grams) },
            recordDraft.revision,
          );
          recordDraft.revision = added.revision;
          await renderRecord();
          return;
        }
        case "record":
          if (!recordDraft.requestId) recordDraft.requestId = crypto.randomUUID();
          await submitMeal(recordDraft.mealId, obj.meal, {
            requestId: recordDraft.requestId,
            expectedRevision: recordDraft.revision,
          });
          break;
        case "reopen-meal":
          if (state.role !== "nutritionist") throw new Error("只有營養師可以重新開啟");
          await reopenMeal(obj.mealId, obj.reason, obj.expectedRevision);
          closeDialog();
          await render();
          toast("已重新開啟，請修正後再審核");
          await openCorrection(obj.mealId);
          return;
        case "correct-item":
        case "correct-add": {
          if (state.role !== "nutritionist") throw new Error("只有營養師可以修正已送出的餐");
          const reason = String(obj.reason || "").trim();
          if (!reason) throw new Error("已送出後的修正需要原因");
          if (formEl.dataset.form === "correct-add") {
            const before = await readMeal(obj.mealId);
            if (before.status !== "submitted") throw new Error("只有已送出的餐可以修正");
            const added = await addMealItem(
              obj.mealId,
              { foodId: obj.foodId, grams: Number(obj.weightG) },
              obj.expectedRevision,
            );
            if (!added.itemId) throw new Error("新增項目沒有寫入");
            await confirmMealItem(obj.mealId,
              added.itemId,
              {
                foodId: obj.foodId,
                weightG: Number(obj.weightG),
                weightSource: "manual",
                reason,
              },
              added.revision,
            );
          } else if (obj.intent === "reject") {
            await rejectMealItem(obj.mealId, obj.itemId, reason, obj.expectedRevision);
          } else if (obj.intent === "delete") {
            await deleteMealItem(obj.mealId, obj.itemId, obj.expectedRevision, reason);
            const after = await readMeal(obj.mealId);
            if (!after.items.length) {
              await render();
              closeDialog();
              toast("項目都刪除了，這筆餐不再列在飲食紀錄");
              return;
            }
          } else {
            const corrected = await confirmMealItem(obj.mealId,
              obj.itemId,
              {
                foodId: obj.foodId,
                weightG: Number(obj.weightG),
                weightSource: "manual",
                reason,
              },
              obj.expectedRevision,
            );
            if (corrected.revision === Number(obj.expectedRevision))
              throw new Error("內容沒有變更");
          }
          await render();
          await openCorrection(obj.mealId);
          toast("已修正，可繼續調整或審核通過");
          return;
        }
        default: {
          const unknown = formEl.dataset.form;
          throw new Error(unknown ? "不支援的表單" : "找不到表單");
        }
      }
      const kiosk = recordDraft?.kiosk;
      closeDialog();
      await render();
      if (kiosk) {
        modal(
          "營養紀錄已完成",
          `<div class="success"><span>${icon("check")}</span><h2>補給到位，繼續突破！</h2><p>紀錄已儲存，3 秒後返回球員選擇畫面。</p></div>`,
        );
        kioskTimer = setTimeout(closeDialog, 3000);
      } else toast("已儲存，營養資料同步更新");
    } catch (error) {
      if (error.status === 409 && error.code === "REVISION_CONFLICT") {
        toast("此餐點已被其他人更新，請重新載入。");
        submit.disabled = false;
        if (recordDraft?.mealId) await renderRecord();
        else if (formEl.dataset.form === "correct-item" || formEl.dataset.form === "correct-add") {
          await render();
          await openCorrection(obj.mealId);
        } else await render();
        return;
      }
      if (error.fields && showFormErrors(formEl, error.fields)) {
        submit.disabled = false;
        return;
      }

      formEl.querySelector(".form-error").textContent = error.message;
      submit.disabled = false;
    }
  });
}
export { render };
export async function startPage(page) {
  currentPage = page;
  state.route = page.route;
  bindEvents();
  let session = null;
  try {
    session = await currentSession();
  } catch (error) {
    if (error.status !== 401) throw error;
  }
  if (!session && !["login", "kiosk"].includes(state.route)) {
    location.replace("/login/index.html");
    return;
  }
  // 已登入使用者可以留在登入頁。此頁提供返回連結與切換帳號。
  if (session && page.role && session.uiRole !== page.role && state.route !== "kiosk") {
    location.replace(pageUrl(session.uiRole, homeRoute(session.uiRole)));
    return;
  }
  state.role = session?.uiRole || page.role || "nutritionist";
  recordFilterOwner = session?.id || null;
  const savedFilters = loadRecordFilters(recordFilterOwner);
  state.recordPlayer = savedFilters.player;
  state.recordMeals = savedFilters.meals;
  const legacyRoute = location.hash.replace(/^#/, "");
  if (
    legacyRoute &&
    legacyRoute !== state.route &&
    allowed(state.role).some((item) => item[0] === legacyRoute)
  ) {
    location.replace(pageUrl(state.role, legacyRoute));
    return;
  }
  render();
}