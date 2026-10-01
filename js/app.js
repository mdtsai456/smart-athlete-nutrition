/**
 * 應用程式入口
 * 協調角色切換、頁面路由、表單事件與攝影機記錄流程。畫面交由 Pages／Components 產生，資料讀寫透過 Service。
 */
import { athleteDetails, athleteForm } from "./components/athlete.js";
import { mountTargets } from "./pages/targets.js";
import { platform, roles, today } from "./services/platform.js";
import { icon, esc, badge, button } from "./components/ui.js";
import { allowed, view } from "./pages/views.js";
import { shell } from "./components/shell.js";
const state = {
  targetPlayer: "p1",
  comparisonPlayer: "p1",
  role: sessionStorage.getItem("role") || "nutritionist",
  date: today,
  data: null,
  filter: "",
  route: "dashboard",
};
const app = document.querySelector("#app"),
  dialog = document.querySelector("#dialog");
let loadVersion = 0,
  kioskTimer,
  recordDraft = null,
  lastFocus;
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 3500);
}
function closeDialog() {
  dialog.close();
  clearTimeout(kioskTimer);
  recordDraft = null;
  lastFocus?.focus();
}
function modal(title, body, wide = false) {
  lastFocus = document.activeElement;
  dialog.className = wide ? "wide" : "";
  dialog.innerHTML = `<div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-action="close" aria-label="關閉">✕</button></div>${body}`;
  if (!dialog.open) dialog.showModal();
}
// 防止快速切換日期／頁面時，較早回來的請求覆蓋最新畫面。
async function render() {
  const token = ++loadVersion;
  let route = location.hash.slice(1) || "login";
  if (route === "choose") {
    route = "camera";
    history.replaceState(null, "", "#camera");
  }
  if (
    route === "players" ||
    (route === "dashboard" && state.role === "nutritionist")
  ) {
    route = "analysis";
    history.replaceState(null, "", "#analysis");
  }
  state.route =
    allowed(state.role).some((n) => n[0] === route) ||
    ["kiosk", "login"].includes(route)
      ? route
      : state.role === "nutritionist"
        ? "analysis"
        : "dashboard";
  app.setAttribute("aria-busy", "true");
  try {
    const data = await platform.load(state.date);
    if (token !== loadVersion) return;
    state.data = data;
    app.innerHTML = shell(state);
    if (state.route === "targets")
      mountTargets(document.querySelector("#targets-root"), {
        data,
        date: state.date,
        playerId: state.targetPlayer,
        onPlayer: (id) => (state.targetPlayer = id),
        onSaved: render,
        notify: toast,
      });
  } catch (e) {
    app.innerHTML = `<div class="error-page"><h1>暫時無法載入資料</h1><p>${esc(e.message)}</p>${button("重新載入", "retry", true)}</div>`;
  } finally {
    if (token === loadVersion) app.removeAttribute("aria-busy");
  }
}
const input = (label, name, type = "text", value = "", extra = "") =>
  `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra} required></label>`;
const select = (label, name, options) =>
  `<label class="field">${label}<select name="${name}">${options}</select></label>`;
const form = (type, body, submit = "儲存") =>
  `<form data-form="${type}">${body}<div class="form-error" role="alert"></div><div class="modal-footer">${button("取消", "close")}<button class="btn primary" type="submit">${submit}</button></div></form>`;
function targetModal(id) {
  const player = state.data.players.find((p) => p.id === id);
  modal(
    `${esc(player.name)} · 運動員資料`,
    `<div class="guide">${athleteDetails(player)}${state.role === "nutritionist" ? `<button class="btn primary" data-action="edit-player" data-id="${esc(player.id)}">編輯運動員資料</button>` : ""}<h3>當日營養狀況</h3><p>${state.date} · ${esc(player.position)}</p>${[
      ["calories", "熱量", "kcal"],
      ["protein", "蛋白質", "g"],
      ["carbs", "碳水", "g"],
      ["fat", "脂肪", "g"],
    ]
      .map(
        ([key, label, unit]) =>
          `<div class="data-row"><span>${label}</span><strong>${player.totals[key]} / ${player.target[key]} ${unit}</strong></div>`,
      )
      .join("")}</div>`,
  );
}
function recordStart(playerId = "p1", kiosk = false) {
  recordDraft = {
    playerId,
    kiosk,
    photo: null,
    items: [],
    date: state.date,
    source: "食物攝影機（模擬）",
  };
  modal(
    "食物攝影機",
    `<div class="guide"><div class="photo-placeholder">${icon("camera")}<strong>請將餐盤放在食物攝影機下方</strong><span>讓所有食物完整出現在拍攝範圍</span></div><p>${esc(state.data.players.find((p) => p.id === playerId).name)} · ${state.date}</p><div class="data-row">1. 攝影機辨識食物與重量</div><div class="data-row">2. 系統比對菜色營養資料表，自動計算本餐營養</div><div class="data-row">3. 確認結果並儲存飲食紀錄</div><p class="notice">攝影機與 AI 尚未串接，目前使用模擬食物與重量展示流程。</p><div class="actions">${button("模擬攝影機辨識", "demo-recognize", true)}</div></div>`,
    true,
  );
  dialog.classList.add("record-dialog");
}
function renderRecord() {
  modal(
    "確認餐點與營養份量",
    `<div class="record-layout"><section><h3>餐盤影像</h3>${recordDraft.photo ? `<img class="record-photo" src="${recordDraft.photo}" alt="上傳的餐盤照片">` : `<div class="photo-placeholder">${icon("camera")}<strong>餐盤照片預覽位置</strong><span>這筆紀錄尚未附上照片</span></div>`}<p class="footnote">${esc(recordDraft.source)}</p></section><section><h3>餐點確認結果</h3><p class="muted">以下為攝影機辨識結果，營養值依資料表自動計算。辨識不正確時請重新拍攝。</p><form data-form="record">${select("餐別", "meal", ["早餐", "午餐", "晚餐", "點心"].map((m) => `<option ${m === (recordDraft.meal || "午餐") ? "selected" : ""}>${m}</option>`).join(""))}<div id="record-items">${recordDraft.items.map((item) => `<div class="data-row"><strong>${esc(item.name)}</strong><span>${item.grams} g</span></div>`).join("")}</div>${button("重新拍攝", "retake")}<p class="footnote">計算方式：每 100 g 營養值 × 辨識重量 ÷ 100，再加總全餐。</p><div id="nutrition-preview" class="nutrition-preview" aria-live="polite"></div><div class="form-error" role="alert"></div><div class="modal-footer">${button("取消", "close")}<button type="submit" class="btn primary">${icon("check")} 確認並儲存紀錄</button></div></form></section></div>`,
    true,
  );
  dialog.classList.add("record-dialog");
  // 營養值已由辨識 Service 依資料表計算；唯讀結果不必再次請求或重新計算。
  const n = recordDraft.nutrition;
  dialog.querySelector("#nutrition-preview").innerHTML =
    `<div><strong>${n.calories}</strong><span>kcal 本餐熱量</span></div><div><strong>${n.protein}g</strong><span>蛋白質</span></div><div><strong>${n.carbs}g</strong><span>碳水化合物</span></div><div><strong>${n.fat}g</strong><span>脂肪</span></div>`;
}
function enterRole(role) {
  state.role = role;
  state.filter = "";
  sessionStorage.setItem("role", role);
  const route = role === "nutritionist" ? "targets" : "dashboard";
  if (location.hash === "#" + route) render();
  else location.hash = route;
}
async function action(name, id) {
  if (name.startsWith("preview-")) return enterRole(name.slice(8));
  if (name === "close") return closeDialog();
  if (name === "retry") return render();
  if (name === "help")
    return modal(
      "使用指南",
      `<div class="guide"><h3>01 切換您的角色</h3><p>右上角可切換營養師、教練與球員視角。</p><h3>02 規劃營養補給</h3><p>營養師選擇球員與日期，區分訓練日與休息日，依總熱量、蛋白質、脂肪底線設定營養目標，剩餘熱量自動分配給碳水。球員透過食物攝影機記錄實際餐點。</p><h3>03 記錄與追蹤</h3><p>攝影機辨識食物與重量後，系統依菜色營養資料表自動計算，確認後更新飲食紀錄與營養分析。</p><p class="notice">示範日期預設為 2026/11/16。資料保存在此瀏覽器；角色切換僅供 UI 展示，正式權限需由後端驗證。</p></div>`,
    );
  if (name === "notifications")
    return modal(
      "今日提醒",
      `<div class="guide">${
        state.data.players
          .filter((p) => p.tone === "orange")
          .map(
            (p) =>
              `<p>${badge("待關注", "orange")} <strong>${esc(p.name)}</strong> 今日熱量達成 ${p.rate}%，請確認飲食紀錄。</p>`,
          )
          .join("") || "<p>今天沒有待關注提醒。</p>"
      }</div>`,
    );
  if (
    ["new-player", "edit-player"].includes(name) &&
    state.role === "nutritionist"
  ) {
    const player =
      name === "edit-player"
        ? state.data.players.find((p) => p.id === id)
        : undefined;
    return modal(
      player ? "編輯運動員資料" : "新增運動員",
      form("player", athleteForm(player)),
      true,
    );
  }
  if (name === "new-food" && state.role === "nutritionist")
    return modal(
      "新增菜色",
      form(
        "food",
        `${input("菜色名稱", "name")}${select("菜色分類", "category", ["蛋白質", "全穀雜糧", "蔬菜", "水果", "乳品", "油脂"].map((x) => `<option>${x}</option>`).join(""))}<p class="notice">請填入每 100 公克的營養資訊。</p><div class="form-grid">${[
          ["calories", "熱量（kcal）"],
          ["protein", "蛋白質（g）"],
          ["carbs", "碳水（g）"],
          ["fat", "脂肪（g）"],
        ]
          .map(([k, l]) =>
            input(l, k, "number", "", 'min="0" max="1000" step="0.1"'),
          )
          .join("")}</div>`,
      ),
    );
  if (name === "target" && state.role === "nutritionist") {
    state.targetPlayer = id;
    location.hash = "targets";
    return;
  }
  if (name === "detail") return targetModal(id);
  if (name === "record") return recordStart();
  if (name === "kiosk-player") return recordStart(id, true);
  if (name === "retake" && recordDraft)
    return recordStart(recordDraft.playerId, recordDraft.kiosk);
  if (name === "demo-recognize" && recordDraft) {
    const draft = recordDraft;
    if (draft.recognizing) return;
    draft.recognizing = true;
    const trigger = dialog.querySelector('[data-action="demo-recognize"]');
    trigger.disabled = true;
    trigger.textContent = "辨識與計算中…";
    try {
      const result = await platform.recognizeMeal({
        playerId: draft.playerId,
        date: draft.date,
      });
      // 關閉或重新拍攝後，忽略前一次辨識回應。
      if (recordDraft !== draft) return;
      Object.assign(draft, result, {
        originalItems: structuredClone(result.items),
      });
      return renderRecord();
    } finally {
      draft.recognizing = false;
      if (trigger.isConnected) {
        trigger.disabled = false;
        trigger.textContent = "模擬攝影機辨識";
      }
    }
  }
  if (name === "record-detail") {
    const r = state.data.records.find((r) => r.id === id);
    return modal(
      `${esc(r.player.name)} · ${r.meal}`,
      `<div class="guide"><p>${r.date} ${r.time} · ${esc(r.source)}</p>${r.photo ? `<img class="record-photo" src="${esc(r.photo)}" alt="餐盤照片">` : ""}${r.items.map((i) => `<p>${esc(state.data.foods.find((f) => f.id === i.foodId)?.name)} <strong>${i.grams} g</strong></p>`).join("")}<div class="notice">熱量 ${r.nutrition.calories} kcal · 蛋白質 ${r.nutrition.protein}g · 碳水 ${r.nutrition.carbs}g · 脂肪 ${r.nutrition.fat}g</div>${r.originalItems ? '<p class="muted">已保留原始攝影機辨識結果；目前使用模擬資料，模型尚未串接。</p>' : ""}</div>`,
    );
  }
}
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (el)
    action(el.dataset.action, el.dataset.id).catch((err) => toast(err.message));
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "comparison-player") {
    state.comparisonPlayer = e.target.value;
    document.querySelector("#page").innerHTML = view(
      state.route,
      state.data,
      state.role,
      state.filter,
      state,
    );
  }
  if (e.target.id === "role") {
    enterRole(e.target.value);
  }
  if (e.target.id === "date") {
    state.date = e.target.value || today;
    await render();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    state.filter = e.target.value;
    const position = e.target.selectionStart;
    document.querySelector("#page").innerHTML = view(
      state.route,
      state.data,
      state.role,
      state.filter,
    );
    const el = document.querySelector("#search");
    el.focus();
    el.setSelectionRange(position, position);
  }
});
dialog.addEventListener("cancel", () => {
  clearTimeout(kioskTimer);
  recordDraft = null;
});
document.addEventListener("submit", async (e) => {
  if (e.target.id === "demo-login") {
    e.preventDefault();
    enterRole(new FormData(e.target).get("loginRole"));
    return;
  }
  const f = e.target.closest("[data-form]");
  if (!f) return;
  e.preventDefault();
  const submit = f.querySelector('[type="submit"]');
  if (submit.disabled) return;
  submit.disabled = true;
  const data = new FormData(f),
    obj = Object.fromEntries(data);
  try {
    switch (f.dataset.form) {
      case "my-profile":
        if (state.role !== "player")
          throw new Error("請以球員身分更新個人資料");
        await platform.updateMyProfile(obj);
        await render();
        toast("個人資料已儲存，教練與營養師可查看更新");
        return;
      case "player":
        if (state.role !== "nutritionist")
          throw new Error("此操作僅供營養師使用");
        if (obj.playerId) await platform.updatePlayer(obj.playerId, obj);
        else await platform.addPlayer(obj);
        break;
      case "food":
        await platform.addFood({
          ...obj,
          calories: +obj.calories,
          protein: +obj.protein,
          carbs: +obj.carbs,
          fat: +obj.fat,
        });
        break;
      case "record":
        await platform.addRecord({
          ...recordDraft,
          recognizing: undefined,
          nutrition: undefined,
          meal: obj.meal,
          modelVersion: recordDraft.modelVersion,
        });
        break;
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
  } catch (err) {
    f.querySelector(".form-error").textContent = err.message;
    submit.disabled = false;
  }
});
window.addEventListener("hashchange", () => {
  state.filter = "";
  render();
});
render();
