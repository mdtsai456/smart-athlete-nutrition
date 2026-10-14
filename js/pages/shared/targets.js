/**
 * 每日營養目標。
 * 選擇球員、編輯草稿，並顯示驗算結果。
 */
import { athleteSummary } from "../../components/athlete-card.js";
import { esc } from "../../components/ui.js";
import {
  saveNutritionPlan,
  saveTargetTemplate,
} from "../../api/plan.api.js";
import {
  planDraft,
  calculatePlan,
  changePlanDay,
  latestTargetTemplate,
  targetTemplateDraft,
} from "../../services/target.service.js";
function rangeNote(player, date) {
  if (player.dailyPlan?.localDate === date)
    return `${date} · 已有當日計畫（第 ${player.dailyPlan.revision} 版）`;
  return `${date} · 尚未有當日計畫，以下為起始值，還不是已確認目標`;
}
const numberField = (name, label, value, unit, step = "0.1") =>
  `<label class="plan-field">${label}<span class="unit-input"><input name="${name}" type="number" step="${step}" min="0" value="${esc(value)}" required><span>${unit}</span></span></label>`;
function resultView(result) {
  if (!result.target)
    return `<div class="plan-alert error" role="alert">${result.errors.map(esc).join("<br>")}</div>`;
  const t = result.target;
  return `<div class="plan-total"><span>每日熱量目標</span><strong>${t.calories.toLocaleString()} <small>kcal</small></strong></div><div class="macro-results">${[
    ["protein", "蛋白質", result.proteinEnergy],
    ["fat", "脂肪", result.fatEnergy],
    ["carbs", "碳水化合物", result.carbsEnergy],
  ]
    .map(
      ([key, label, energy]) =>
        `<div class="macro-result ${key}"><span>${label}</span><strong>${t[key]} <small>g</small></strong><small>${energy} kcal</small></div>`,
    )
    .join(
      "",
    )}</div><div class="carb-check"><span>碳水 / 體重</span><strong>${result.carbRate} <small>g/kg</small></strong></div><div class="day-carb-summary"><strong>${esc(result.training)} · 碳水需求 ${result.carbMinimum} g/kg</strong><p>最低需求 ${result.carbRequired} g ／ 目前分配 ${t.carbs} g</p><span class="${result.carbShortfall > 0.1 ? "warn" : "good"}">${result.carbShortfall > 0.1 ? `尚差 ${result.carbShortfall} g 碳水` : "已達當日碳水需求"}</span></div><div class="energy-check"><strong>熱量驗算</strong><p>${t.protein} × 4 ＋ ${t.carbs} × 4 ＋ ${t.fat} × 9</p><span>= ${result.energy} kcal</span><small class="${Math.abs(result.difference) > 5 ? "warn" : "good"}">與目標差 ${result.difference > 0 ? "+" : ""}${result.difference} kcal · 容許四捨五入差 ±5 kcal</small></div>${result.errors.map((message) => `<div class="plan-alert error" role="alert">${esc(message)}</div>`).join("")}${result.warnings.map((message) => `<div class="plan-alert warning">${esc(message)}</div>`).join("")}${!result.warnings.length && result.valid ? '<div class="plan-alert okay">符合已設定的碳水需求與脂肪底線。</div>' : ""}`;
}
/** 訓練日與休息日範本分開編輯，並沿用每日計畫的驗算規則。 */
export function mountTargetTemplates(
  root,
  { data, date, playerId, onSaved, notify },
) {
  const drafts = new Map();
  const dirty = new Set();
  let player = data.players.find((item) => item.id === playerId) || data.players[0];
  let training = "訓練日";
  let saving = false;

  function draftFor(dayType) {
    if (!drafts.has(dayType))
      drafts.set(
        dayType,
        targetTemplateDraft(player, data.targetTemplates, date, dayType),
      );
    return drafts.get(dayType);
  }
  function currentTemplate() {
    return latestTargetTemplate(data.targetTemplates, player.id, training);
  }
  function statusText() {
    if (dirty.has(training)) return "尚有未儲存變更";
    const saved = currentTemplate();
    return saved ? `已儲存第 ${saved.revision} 版` : "尚未儲存，以下為起始值";
  }
  function draw() {
    const draft = draftFor(training);
    const result = calculatePlan(draft);
    root.innerHTML = `<section class="panel target-template-panel"><div class="panel-heading"><div><h2>訓練日／休息日目標範本</h2><p>為 ${esc(player.name)} #${esc(player.number)} 分別設定兩組目標；範本不會覆寫任何日期的已儲存計畫。</p></div></div><div class="template-tabs" role="group" aria-label="目標範本日別">${["訓練日", "休息日"].map((dayType) => `<button type="button" aria-pressed="${training === dayType}" class="template-tab${training === dayType ? " active" : ""}" data-template-tab="${dayType}">${dayType}<small>${dirty.has(dayType) ? "未儲存" : latestTargetTemplate(data.targetTemplates, player.id, dayType) ? "已設定" : "尚未設定"}</small></button>`).join("")}</div><p class="template-status" role="status">${esc(statusText())}</p><form id="target-template-form"><div class="planner-layout"><section class="panel planner-editor"><div class="plan-step"><span class="step-index">1</span><div><h2>決定總熱量</h2><div class="plan-fields">${numberField("calories", "每日熱量", draft.calories, "kcal", "1")}${numberField("weight", "計算體重", draft.weight, "kg")}</div><p class="plan-hint">計算體重只用於換算範本中的 g/kg 目標，不會修改球員基本資料。</p></div></div><div class="plan-step"><span class="step-index">2</span><div><h2>設定蛋白質</h2>${numberField("proteinKg", "每公斤體重", draft.proteinKg, "g/kg")}</div></div><div class="plan-step"><span class="step-index">3</span><div><h2>設定脂肪底線</h2><div class="plan-fields fat-fields">${numberField("fatValue", "脂肪底線", draft.fatValue, draft.fatUnit === "kg" ? "g/kg" : "%")}<label class="plan-field">計算方式<select name="fatUnit"><option value="kg" ${draft.fatUnit === "kg" ? "selected" : ""}>依體重 g/kg</option><option value="percent" ${draft.fatUnit === "percent" ? "selected" : ""}>依總熱量 %</option></select></label></div><p class="plan-hint">扣除蛋白質與脂肪熱量後，剩餘熱量自動分配給碳水。</p></div></div><div class="plan-step"><span class="step-index">4</span><div><h2>檢查訓練需求</h2><div class="plan-fields"><label class="plan-field">當日類型<select disabled><option>${training}</option></select></label>${numberField("carbMinimum", "碳水最低需求", draft.carbMinimum, "g/kg")}</div><p class="plan-hint">預設需求：訓練日 6、休息日 4 g/kg，營養師可各自調整。</p></div></div><details class="manual-plan" ${draft.manual ? "open" : ""}><summary>手動微調營養素</summary><label class="manual-toggle"><input name="manual" type="checkbox" ${draft.manual ? "checked" : ""}> 啟用手動調整（保留熱量驗算）</label><div class="plan-fields manual-fields">${["protein", "fat", "carbs"].map((key, index) => numberField(key, ["蛋白質", "脂肪", "碳水"][index], draft.manual ? draft[key] : result.target?.[key] || 0, "g")).join("")}</div><p class="plan-hint">啟用後可直接輸入三大營養素；與總熱量差距須在 ±5 kcal 內。</p></details></section><aside class="panel planner-summary"><div class="summary-heading"><span class="step-index">5</span><h2>驗算與確認</h2></div><div id="target-template-results" aria-live="polite">${resultView(result)}</div><label class="plan-review" ${result.warnings.length ? "" : "hidden"}><input name="reviewed" type="checkbox"> 已檢查上述提醒，確認採用此目標</label><div class="form-error" role="alert"></div><button class="btn primary plan-save" type="submit">儲存${training}目標</button></aside></div></form></section>`;
    root
      .querySelectorAll(".manual-fields input")
      .forEach((input) => (input.disabled = !draft.manual));
    root.querySelector(".plan-save").disabled = !result.valid;
  }
  function markDirty() {
    dirty.add(training);
    root.querySelector(".template-status").textContent = statusText();
    root.querySelectorAll(".template-tab").forEach((button) => {
      if (button.dataset.templateTab === training)
        button.querySelector("small").textContent = "未儲存";
    });
  }
  function recalculate() {
    const draft = draftFor(training);
    const result = calculatePlan(draft);
    root.querySelector("#target-template-results").innerHTML = resultView(result);
    const review = root.querySelector(".plan-review");
    review.hidden = !result.warnings.length;
    review.querySelector("input").checked = false;
    root.querySelector(".form-error").textContent = "";
    root.querySelector(".plan-save").disabled = !result.valid || saving;
    if (!draft.manual)
      root.querySelectorAll(".manual-fields input").forEach((input) => {
        input.value = result.target?.[input.name] ?? 0;
      });
  }
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-template-tab]");
    if (!button) return;
    training = button.dataset.templateTab;
    draw();
  });
  root.addEventListener("input", (event) => {
    const input = event.target;
    if (input.type !== "number" || !input.closest("#target-template-form"))
      return;
    markDirty();
    const draft = draftFor(training);
    draft[input.name] = input.value;
    if (!["protein", "fat", "carbs"].includes(input.name)) {
      draft.manual = false;
      root.querySelector('[name="manual"]').checked = false;
      root
        .querySelectorAll(".manual-fields input")
        .forEach((field) => (field.disabled = true));
    }
    recalculate();
  });
  root.addEventListener("change", (event) => {
    const input = event.target;
    if (!input.closest("#target-template-form")) return;
    if (input.name === "manual") {
      markDirty();
      const draft = draftFor(training);
      const automaticTarget = calculatePlan({
        ...draft,
        manual: false,
      }).target;
      draft.manual = input.checked;
      if (draft.manual)
        Object.assign(draft, automaticTarget || {
          protein: 0,
          carbs: 0,
          fat: 0,
        });
      draw();
      return;
    }
    if (input.name === "fatUnit") {
      markDirty();
      const draft = draftFor(training);
      draft.fatUnit = input.value;
      draft.fatValue = input.value === "kg" ? 1 : 25;
      draft.manual = false;
      draw();
    }
  });
  root.addEventListener("submit", async (event) => {
    if (event.target.id !== "target-template-form") return;
    event.preventDefault();
    if (saving) return;
    saving = true;
    root.querySelector(".plan-save").disabled = true;
    try {
      const saved = currentTemplate();
      await saveTargetTemplate(
        player.id,
        training,
        draftFor(training),
        root.querySelector('[name="reviewed"]').checked,
        saved?.revision,
      );
      await onSaved();
      notify(`${training}目標範本已儲存`);
    } catch (error) {
      root.querySelector(".form-error").textContent = error.message;
      root.querySelector(".plan-save").disabled = !calculatePlan(
        draftFor(training),
      ).valid;
    } finally {
      saving = false;
    }
  });
  draw();
  return {
    setPlayer(id) {
      player = data.players.find((item) => item.id === id) || data.players[0];
      drafts.clear();
      dirty.clear();
      draw();
    },
  };
}
/** 修改分配條件後，切換至自動模式並重新計算。有提醒時，必須勾選確認才能儲存。 */
export function mountTargets(
  root,
  { data, date, playerId, onPlayer, onSaved, notify },
) {
  let player = data.players.find((p) => p.id === playerId) || data.players[0];
  let draft = planDraft(player, date),
    result = calculatePlan(draft),
    saving = false,
    dirty = false;
  function draw() {
    result = calculatePlan(draft);
    root.innerHTML = `<div class="planner-context"><label>球員<select id="target-player">${data.players.map((p) => `<option value="${p.id}" ${p.id === player.id ? "selected" : ""}>${esc(p.name)} #${p.number}</option>`).join("")}</select></label><span>${dirty ? `${date} · 尚有未儲存變更` : rangeNote(player, date)}</span></div>${athleteSummary(player)}<form id="nutrition-plan"><div class="planner-layout"><section class="panel planner-editor"><div class="plan-step"><span class="step-index">1</span><div><h2>決定總熱量</h2><div class="plan-fields">${numberField("calories", "每日熱量", draft.calories, "kcal", "1")}${numberField("weight", "計算體重", draft.weight, "kg")}</div><p class="plan-hint">這個體重只用來換算這一天的 g/kg，存在當日計畫裡，不會改球員基本資料。</p></div></div><div class="plan-step"><span class="step-index">2</span><div><h2>設定蛋白質</h2>${numberField("proteinKg", "每公斤體重", draft.proteinKg, "g/kg")}</div></div><div class="plan-step"><span class="step-index">3</span><div><h2>設定脂肪底線</h2><div class="plan-fields fat-fields">${numberField("fatValue", "脂肪底線", draft.fatValue, draft.fatUnit === "kg" ? "g/kg" : "%")}<label class="plan-field">計算方式<select name="fatUnit"><option value="kg" ${draft.fatUnit === "kg" ? "selected" : ""}>依體重 g/kg</option><option value="percent" ${draft.fatUnit === "percent" ? "selected" : ""}>依總熱量 %</option></select></label></div><p class="plan-hint">剩餘熱量自動分配給碳水。</p></div></div><div class="plan-step"><span class="step-index">4</span><div><h2>檢查訓練需求</h2><div class="plan-fields"><label class="plan-field">當日類型<select name="training">${["訓練日", "休息日"].map((x) => `<option ${draft.training === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>${numberField("carbMinimum", "碳水最低需求", draft.carbMinimum, "g/kg")}</div><p class="plan-hint">切換自動帶入：訓練日 6、休息日 4 g/kg，營養師可再調整。此為需求檢查值，實際碳水仍由剩餘熱量計算。</p></div></div><details class="manual-plan" ${draft.manual ? "open" : ""}><summary>手動微調營養素</summary><label class="manual-toggle"><input name="manual" type="checkbox" ${draft.manual ? "checked" : ""}> 啟用手動調整（保留熱量驗算）</label><div class="plan-fields manual-fields">${["protein", "fat", "carbs"].map((key, i) => numberField(key, ["蛋白質", "脂肪", "碳水"][i], draft.manual ? draft[key] : result.target?.[key] || 0, "g")).join("")}</div><p class="plan-hint">修改前面的分配條件後，會回到自動計算。</p></details></section><aside class="panel planner-summary"><div class="summary-heading"><span class="step-index">5</span><h2>驗算與確認</h2></div><div id="plan-results" aria-live="polite">${resultView(result)}</div><label class="plan-review" ${result.warnings.length ? "" : "hidden"}><input name="reviewed" type="checkbox"> 已檢查上述提醒，確認採用此目標</label><div class="form-error" role="alert"></div><button class="btn primary plan-save" type="submit">確認並儲存目標</button><p class="plan-hint">只為 ${date} 儲存 ${esc(player.name)} 的每日計畫。四項目標由系統重算，不會套到其他日期。</p></aside></div></form>`;
    root
      .querySelectorAll(".manual-fields input")
      .forEach((el) => (el.disabled = !draft.manual));
    root.querySelector(".plan-save").disabled = !result.valid;
  }
  function markDirty() {
    dirty = true;
    root.querySelector(".planner-context > span").textContent =
      `${date} · 尚有未儲存變更`;
  }
  function recalculate() {
    result = calculatePlan(draft);
    root.querySelector("#plan-results").innerHTML = resultView(result);
    const review = root.querySelector(".plan-review");
    review.hidden = !result.warnings.length;
    review.querySelector("input").checked = false;
    root.querySelector(".form-error").textContent = "";
    root.querySelector(".plan-save").disabled = !result.valid || saving;
    if (!draft.manual)
      root
        .querySelectorAll(".manual-fields input")
        .forEach((el) => (el.value = result.target?.[el.name] ?? 0));
  }
  root.addEventListener("input", (e) => {
    if (e.target.type !== "number") return;
    markDirty();
    draft[e.target.name] = e.target.value;
    if (!["protein", "fat", "carbs"].includes(e.target.name)) {
      draft.manual = false;
      root.querySelector('[name="manual"]').checked = false;
      root
        .querySelectorAll(".manual-fields input")
        .forEach((el) => (el.disabled = true));
    }
    recalculate();
  });
  root.addEventListener("change", (e) => {
    if (e.target.id === "target-player") {
      player = data.players.find((p) => p.id === e.target.value);
      dirty = false;
      onPlayer(player.id);
      draft = planDraft(player, date);
      draw();
      return;
    }
    if (e.target.name === "manual") {
      markDirty();
      draft.manual = e.target.checked;
      if (draft.manual)
        Object.assign(draft, result.target || { protein: 0, carbs: 0, fat: 0 });
      draw();
      return;
    }
    if (["training", "fatUnit"].includes(e.target.name)) {
      markDirty();
      draft[e.target.name] = e.target.value;
      if (e.target.name === "fatUnit") {
        draft.fatValue = draft.fatUnit === "kg" ? 1 : 25;
        draft.manual = false;
        draw();
      } else {
        draft = changePlanDay(draft, e.target.value);
        root.querySelector('[name="carbMinimum"]').value = draft.carbMinimum;
        recalculate();
      }
    }
  });
  root.addEventListener("submit", async (e) => {
    if (e.target.id !== "nutrition-plan") return;
    e.preventDefault();
    if (saving) return;
    saving = true;
    root.querySelector(".plan-save").disabled = true;
    try {
      await saveNutritionPlan(
        player.id,
        date,
        draft,
        root.querySelector('[name="reviewed"]').checked,
      );
      await onSaved();
      notify("營養目標已按營養素生效");
    } catch (error) {
      root.querySelector(".form-error").textContent = error.message;
      root.querySelector(".plan-save").disabled = !result.valid;
    } finally {
      saving = false;
    }
  });
  draw();
}
