/**
 * 每日營養目標。
 * 範本是每位球員各一組訓練日、一組休息日，每一週共用。
 * 儲存這一週只寫日別。右邊只讀已儲存的範本。換日不重載，頁首日期一起換。
 */
import { athleteSummary } from "../../components/athlete-card.js";
import { esc, shown } from "../../components/ui.js";
import { saveDayMarks, saveTargetTemplate } from "../../api/plan.api.js";
import { CARB_DAY_PRESETS, calculatePlan, dayTypeOn, weekDates } from "../../services/target.service.js";

const TYPE_LABEL = { training: "訓練日", rest: "休息日" };
const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];
const numberField = (name, label, value, unit, step = "0.1") =>
  `<label class="plan-field">${label}<span class="unit-input"><input name="${name}" type="number" step="${step}" min="0" value="${esc(value)}" required><span>${unit}</span></span></label>`;

/** 還沒存過時的起點。訓練日碳水 6 g/kg，休息日 4 g/kg。 */
function blankTemplate(type, player) {
  const training = type === "training";
  return {
    weight: Number(player.weight) || 0,
    calories: training ? 2800 : 2400,
    proteinKg: training ? 1.6 : 1.4,
    fatUnit: "kg",
    fatValue: 1,
    carbMinimum: CARB_DAY_PRESETS[TYPE_LABEL[type]],
    training: TYPE_LABEL[type],
    manual: false,
  };
}

function draftFrom(player, type) {
  const saved = (player.templates || []).find((row) => row.trainingType === type);
  const base = blankTemplate(type, player);
  if (!saved?.input) return base;
  return { ...base, ...saved.input, training: TYPE_LABEL[type] };
}

function resultView(result) {
  if (!result.target)
    return `<div class="plan-alert error" role="alert">${result.errors.map(esc).join("<br>")}</div>`;
  const t = result.target;
  return `<div class="plan-total"><span>每日熱量目標</span><strong>${shown(t.calories)} <small>kcal</small></strong></div><div class="macro-results">${[
    ["protein", "蛋白質", result.proteinEnergy],
    ["fat", "脂肪", result.fatEnergy],
    ["carbs", "碳水化合物", result.carbsEnergy],
  ]
    .map(
      ([key, label, energy]) =>
        `<div class="macro-result ${key}"><span>${label}</span><strong>${shown(t[key])} <small>g</small></strong><small>${shown(energy)} kcal</small></div>`,
    )
    .join(
      "",
    )}</div><div class="carb-check"><span>碳水 / 體重</span><strong>${shown(result.carbRate)} <small>g/kg</small></strong></div><div class="day-carb-summary"><strong>${esc(result.training)} · 碳水需求 ${shown(result.carbMinimum)} g/kg</strong><p>最低需求 ${shown(result.carbRequired)} g ／ 目前分配 ${shown(t.carbs)} g</p><span class="${result.carbShortfall > 0.1 ? "warn" : "good"}">${result.carbShortfall > 0.1 ? `尚差 ${shown(result.carbShortfall)} g 碳水` : "已達當日碳水需求"}</span></div><div class="energy-check"><strong>熱量驗算</strong><p>${shown(t.protein)} × 4 ＋ ${shown(t.carbs)} × 4 ＋ ${shown(t.fat)} × 9</p><span>= ${shown(result.energy)} kcal</span><small class="${Math.abs(result.difference) > 5 ? "warn" : "good"}">與目標差 ${result.difference > 0 ? "+" : ""}${shown(result.difference)} kcal · 容許四捨五入差 ±5 kcal</small></div>${result.errors.map((message) => `<div class="plan-alert error" role="alert">${esc(message)}</div>`).join("")}${result.warnings.map((message) => `<div class="plan-alert warning">${esc(message)}</div>`).join("")}${!result.warnings.length && result.valid ? '<div class="plan-alert okay">符合已設定的碳水需求與脂肪底線。</div>' : ""}`;
}

/** 右邊只讀已儲存的範本。畫面上還沒按儲存的數字不算。 */
function appliedTarget(player, type) {
  return (player.templates || []).find((row) => row.trainingType === type)?.target || null;
}

function daySentence(type, target) {
  if (type === "pending") return "待確認。這天還沒排是訓練日還是休息日。";
  const label = TYPE_LABEL[type];
  if (!target) return `這天是${label}，還沒有${label}範本，目標顯示未設定。`;
  return `套用${label}範本。`;
}

/** 這一頁的互動。換日不重載，避免清掉還沒儲存的日別和範本草稿。 */
export function mountTargets(
  root,
  { data, date, playerId, onPlayer, onDate, onSaved, notify },
) {
  let viewed = date;
  let player = data.players.find((p) => p.id === playerId) || data.players[0];
  let templateType = "training";
  let drafts;
  let marks;
  let saving = false;
  const abort = new AbortController();
  if (root._targetsAbort) root._targetsAbort.abort();
  root._targetsAbort = abort;
  const listen = { signal: abort.signal };

  function loadPlayer(next) {
    player = next;
    drafts = {
      training: draftFrom(player, "training"),
      rest: draftFrom(player, "rest"),
    };
    marks = Object.fromEntries(
      weekDates(viewed).map((iso) => [
        iso,
        dayTypeOn(player.dayMarks || [], player.id, iso),
      ]),
    );
  }

  loadPlayer(player);

  function currentView() {
    const type = marks[viewed] || "pending";
    return { type, target: type === "pending" ? null : appliedTarget(player, type) };
  }

  function draw() {
    const draft = drafts[templateType];
    const result = calculatePlan(draft);
    const { type: viewedType, target: viewedTarget } = currentView();
    root.innerHTML = `<div class="planner-context"><label>球員<select id="target-player">${data.players.map((p) => `<option value="${p.id}" ${p.id === player.id ? "selected" : ""}>${esc(p.name)} #${p.number}</option>`).join("")}</select></label><span id="day-status">${esc(viewed)} · ${esc(daySentence(viewedType, viewedTarget))}</span></div>${athleteSummary(player)}<div class="targets-top"><section class="panel panel-padded week-card"><form id="week-form"><div class="week-board">${weekDates(viewed)
      .map((iso) => {
        const weekday = WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()];
        const selected = marks[iso] || "pending";
        return `<div class="week-day${iso === viewed ? " is-viewed" : ""}" data-view-date="${iso}"><button type="button" class="week-day-pick"${iso === viewed ? ' aria-current="date"' : ""}><span>${shortDate(iso)}</span><small>週${weekday}</small></button><select data-date="${iso}" aria-label="${iso} 日別">${[
          ["pending", "待確認"],
          ["training", "訓練日"],
          ["rest", "休息日"],
        ]
          .map(
            ([value, label]) =>
              `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`,
          )
          .join("")}</select></div>`;
      })
      .join("")}</div><button class="btn" type="submit">儲存這一週</button><p class="plan-hint">待確認維持未排，不會自動變成休息日。已排的日子會套用對應範本。</p></form></section><section class="panel panel-padded day-apply"><h2 id="day-title">${shortDate(viewed)} 這一天</h2><div id="day-numbers">${dayNumbers(viewedTarget)}</div></section></div><section class="panel planner-editor"><div class="template-switch" role="tablist">${["training", "rest"]
      .map(
        (type) =>
          `<button type="button" data-template="${type}" aria-selected="${templateType === type}">${TYPE_LABEL[type]}</button>`,
      )
      .join("")}</div><p class="plan-hint">這裡改的是${TYPE_LABEL[templateType]}範本。切換會換整組數字，不會改某一天。</p><form id="template-form"><div class="planner-layout"><div><div class="plan-fields">${numberField("calories", "每日熱量", draft.calories, "kcal", "1")}${numberField("weight", "計算體重", draft.weight, "kg")}${numberField("proteinKg", "蛋白質", draft.proteinKg, "g/kg")}${numberField("fatValue", "脂肪底線", draft.fatValue, draft.fatUnit === "kg" ? "g/kg" : "%")}${numberField("carbMinimum", "碳水最低需求", draft.carbMinimum, "g/kg")}</div><label class="plan-field">脂肪計算方式<select name="fatUnit"><option value="kg" ${draft.fatUnit === "kg" ? "selected" : ""}>依體重 g/kg</option><option value="percent" ${draft.fatUnit === "percent" ? "selected" : ""}>依總熱量 %</option></select></label></div><aside class="planner-summary"><div id="plan-results">${resultView(result)}</div><label class="plan-review" ${result.warnings.length ? "" : "hidden"}><input name="reviewed" type="checkbox"> 已檢查上述提醒，確認採用此範本</label><div class="form-error" role="alert"></div><button class="btn primary plan-save" type="submit" ${!result.valid ? "disabled" : ""}>儲存${TYPE_LABEL[templateType]}範本</button></aside></div></form></section>`;
  }

  function dayNumbers(target) {
    const rows = [
      ["熱量", target?.calories, "kcal"],
      ["蛋白質", target?.protein, "g"],
      ["碳水", target?.carbs, "g"],
      ["脂肪", target?.fat, "g"],
    ];
    return rows
      .map(
        ([label, value, unit]) =>
          `<div class="data-row"><strong>${label}</strong><span>${shown(value)} ${unit}</span></div>`,
      )
      .join("");
  }

  function shortDate(iso) {
    const [, month, day] = iso.split("-");
    return `${Number(month)}/${Number(day)}`;
  }

  function showDay(iso) {
    if (!iso) return;
    viewed = iso;
    const input = document.querySelector("#date");
    if (input) input.value = iso;
    onDate(iso);
    refreshDay();
  }

  function refreshDay() {
    root.querySelectorAll(".week-day").forEach((card) => {
      const selected = card.dataset.viewDate === viewed;
      card.classList.toggle("is-viewed", selected);
      const pick = card.querySelector(".week-day-pick");
      if (pick) {
        if (selected) pick.setAttribute("aria-current", "date");
        else pick.removeAttribute("aria-current");
      }
    });
    const { type: viewedType, target: viewedTarget } = currentView();
    const status = root.querySelector("#day-status");
    const title = root.querySelector("#day-title");
    const numbers = root.querySelector("#day-numbers");
    if (status) status.textContent = `${viewed} · ${daySentence(viewedType, viewedTarget)}`;
    if (title) title.textContent = `${shortDate(viewed)} 這一天`;
    if (numbers) numbers.innerHTML = dayNumbers(viewedTarget);
  }

  /** 修改範本後重新計算。有提醒時，必須勾選確認才能儲存這組範本。 */
  function recalculate() {
    const result = calculatePlan(drafts[templateType]);
    const form = root.querySelector("#template-form");
    if (!form) return;
    form.querySelector("#plan-results").innerHTML = resultView(result);
    const review = form.querySelector(".plan-review");
    review.hidden = !result.warnings.length;
    review.querySelector("input").checked = false;
    form.querySelector(".form-error").textContent = "";
    form.querySelector(".plan-save").disabled = !result.valid || saving;
  }

  root.addEventListener("click", (event) => {
    const card = event.target.closest("[data-view-date]");
    // 點下拉只改日別，不把這次點擊當成換日。
    if (card && !event.target.closest("select")) {
      showDay(card.dataset.viewDate);
      return;
    }
    const tab = event.target.closest("[data-template]");
    if (!tab) return;
    templateType = tab.dataset.template;
    draw();
  }, listen);

  root.addEventListener("input", (event) => {
    if (event.target.type !== "number" || !event.target.closest("#template-form")) return;
    drafts[templateType][event.target.name] = event.target.value;
    recalculate();
  }, listen);

  root.addEventListener("change", (event) => {
    if (event.target.id === "target-player") {
      const next = data.players.find((item) => item.id === event.target.value);
      onPlayer(next.id);
      loadPlayer(next);
      draw();
      return;
    }
    if (event.target.dataset.date) {
      marks[event.target.dataset.date] = event.target.value;
      showDay(event.target.dataset.date);
      return;
    }
    if (event.target.name === "fatUnit") {
      drafts[templateType].fatUnit = event.target.value;
      drafts[templateType].fatValue = event.target.value === "kg" ? 1 : 25;
      draw();
    }
  }, listen);

  root.addEventListener("submit", async (event) => {
    if (saving) return;
    if (event.target.id === "week-form") {
      event.preventDefault();
      saving = true;
      try {
        await saveDayMarks(
          player.id,
          Object.entries(marks).map(([localDate, dayType]) => ({ localDate, dayType })),
        );
        await onSaved();
        notify("這一週的日別已儲存");
      } catch (error) {
        notify(error.message);
      } finally {
        saving = false;
      }
      return;
    }
    if (event.target.id !== "template-form") return;
    event.preventDefault();
    const draft = drafts[templateType];
    const result = calculatePlan(draft);
    const errorBox = event.target.querySelector(".form-error");
    if (!result.valid) {
      errorBox.textContent = result.errors.join(" ");
      return;
    }
    if (result.warnings.length && !event.target.querySelector('[name="reviewed"]').checked) {
      errorBox.textContent = "請先檢查提醒，再勾選確認。";
      return;
    }
    saving = true;
    event.target.querySelector(".plan-save").disabled = true;
    try {
      await saveTargetTemplate(
        player.id,
        templateType,
        draft,
        event.target.querySelector('[name="reviewed"]').checked,
      );
      await onSaved();
      notify(`${TYPE_LABEL[templateType]}範本已儲存`);
    } catch (error) {
      errorBox.textContent = error.message;
      event.target.querySelector(".plan-save").disabled = !result.valid;
    } finally {
      saving = false;
    }
  }, listen);

  draw();
}
