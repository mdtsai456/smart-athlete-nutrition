/**
 * 每日營養目標。
 * 選擇球員、編輯草稿，並顯示驗算結果。
 */
import { athleteSummary } from "../../components/athlete-card.js";
import { esc } from "../../components/ui.js";
import { saveNutritionPlan } from "../../api/plan.api.js";
import {
  listTargetProfiles,
  saveTargetProfile,
} from "../../api/target-profile.api.js";
import {
  planDraft,
  calculatePlan,
  changePlanDay,
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

/**
 * 訓練日／休息日目標範本編輯器。
 * 與既有每日計畫分開儲存。
 */
export async function mountTargetProfiles(
  root,
  { data, playerId, date, onSaved, notify },
) {
  let athleteId = playerId || data.players[0]?.id;
  let dayType = "training";
  let reviewed = false;
  let saving = false;
  let profiles = [];
  let draft;

  const dayLabel = {
    training: "訓練日",
    rest: "休息日",
  };

  function defaultDraft(player, type) {
    return {
      weight: Number(player.weight),
      calories: type === "training" ? 2800 : 2400,
      proteinKg: 1.6,
      fatUnit: "kg",
      fatValue: 1,
      carbMinimum: type === "training" ? 6 : 4,
      training: dayLabel[type],
      manual: false,
    };
  }

  async function loadProfile() {
    profiles = await listTargetProfiles(athleteId);

    const saved = profiles
      .filter((row) => row.trainingType === dayType)
      .filter(
        (row) =>
          row.startDate <= date &&
          (row.endDate == null || row.endDate >= date),
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

    const player = data.players.find((p) => p.id === athleteId);

    draft = saved?.inputJson
      ? { ...saved.inputJson }
      : defaultDraft(player, dayType);

    draft.training = dayLabel[dayType];
    reviewed = false;
    draw();
  }

  function draw() {
    const result = calculatePlan(draft);
    const saved = profiles
      .filter((row) => row.trainingType === dayType)
      .filter(
        (row) =>
          row.startDate <= date &&
          (row.endDate == null || row.endDate >= date),
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

    root.innerHTML = `
      <section class="panel">
        <h2>訓練日／休息日目標範本</h2>
        <p class="plan-hint">
          兩組目標獨立儲存。可分別儲存訓練日與休息日目標，未單獨設定時將作為預設依據。
        </p>

        <label class="field">
          球員
          <select name="profileAthlete">
            ${data.players.map((p) => `
              <option value="${esc(p.id)}"
                ${p.id === athleteId ? "selected" : ""}>
                ${esc(p.name)} #${p.number}
              </option>
            `).join("")}
          </select>
        </label>

        <label class="field">
          目標類型
          <select name="profileType">
            <option value="training" ${dayType === "training" ? "selected" : ""}>
              訓練日目標
            </option>
            <option value="rest" ${dayType === "rest" ? "selected" : ""}>
              休息日目標
            </option>
          </select>
        </label>

        <p class="plan-hint">
          ${saved
            ? `目前 ${dayLabel[dayType]} 生效版本：${esc(saved.startDate)}`
            : `此球員目前尚無 ${dayLabel[dayType]} 的已儲存目標，以下為系統起始值。`}
        </p>

        <form id="target-profile-form">
          <div class="plan-fields">
            ${numberField("calories", "每日熱量", draft.calories, "kcal", "1")}
            ${numberField("weight", "計算體重", draft.weight, "kg")}
            ${numberField("proteinKg", "蛋白質", draft.proteinKg, "g/kg")}
            ${numberField("fatValue", "脂肪底線", draft.fatValue,
              draft.fatUnit === "kg" ? "g/kg" : "%")}
            ${numberField("carbMinimum", "碳水最低需求", draft.carbMinimum, "g/kg")}
          </div>

          <label class="field">
            脂肪計算方式
            <select name="fatUnit">
              <option value="kg" ${draft.fatUnit === "kg" ? "selected" : ""}>
                依體重 g/kg
              </option>
              <option value="percent" ${draft.fatUnit === "percent" ? "selected" : ""}>
                依總熱量百分比
              </option>
            </select>
          </label>

          <label class="field">
            生效日期
            <input name="startDate" type="date" value="${esc(date)}" required>
          </label>

          <div id="profile-result">
            ${resultView(result)}
          </div>

          <label class="plan-review" ${result.warnings.length ? "" : "hidden"}>
            <input name="reviewed" type="checkbox">
            已檢查提醒，確認採用此目標
          </label>

          <div class="form-error" role="alert"></div>

          <div class="button-group" style="display: flex; gap: 10px; margin-top: 15px;">
            <button class="btn primary" type="submit" name="saveTraining"
              ${!result.valid ? "disabled" : ""}>
              儲存訓練日目標
            </button>
            <button class="btn secondary" type="button" id="save-rest-btn"
              ${!result.valid ? "disabled" : ""}>
              儲存休息日目標
            </button>
          </div>
        </form>
      </section>
    `;

    const form = root.querySelector("#target-profile-form");

    form.addEventListener("input", (event) => {
      const field = event.target;
      if (field.type === "checkbox" || field.type === "date") return;

      if (field.name === "fatUnit") {
        draft.fatUnit = field.value;
        draft.fatValue = field.value === "kg" ? 1 : 25;
      } else {
        draft[field.name] = field.value;
      }

      if (field.name !== "reviewed") reviewed = false;
      updateResult();
    });

    form.addEventListener("change", async (event) => {
      if (event.target.name === "profileType") {
        dayType = event.target.value;
        await loadProfile();
      }
      if (event.target.name === "profileAthlete") {
        athleteId = event.target.value;
        await loadProfile();
      }
      if (event.target.name === "reviewed") {
        reviewed = event.target.checked;
      }
    });

    // 支援獨立儲存休息日按鈕事件
    root.querySelector("#save-rest-btn").addEventListener("click", async () => {
      await handleProfileSubmit("rest");
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleProfileSubmit(dayType);
    });

    async function handleProfileSubmit(targetDayType) {
      if (saving) return;

      const result = calculatePlan(draft);
      const errorBox = form.querySelector(".form-error");
      const startDate = form.querySelector('[name="startDate"]').value;

      if (!result.valid) {
        errorBox.textContent = result.errors.join(" ");
        return;
      }

      if (result.warnings.length && !reviewed) {
        errorBox.textContent = "請先確認碳水或脂肪提醒。";
        return;
      }

      saving = true;
      try {
        await saveTargetProfile(
          athleteId,
          targetDayType,
          startDate,
          { ...draft, training: dayLabel[targetDayType] },
          reviewed,
        );

        await loadProfile();
        await onSaved?.();
        notify?.(`${dayLabel[targetDayType]}目標已成功儲存`);
      } catch (error) {
        errorBox.textContent = error.message;
      } finally {
        saving = false;
      }
    }
  }

  function updateResult() {
    const result = calculatePlan(draft);
    const form = root.querySelector("#target-profile-form");
    if (!form) return;

    form.querySelector("#profile-result").innerHTML = resultView(result);
    const review = form.querySelector(".plan-review");
    review.hidden = !result.warnings.length;

    form.querySelector(".form-error").textContent = "";
    const isValid = result.valid && !saving;
    form.querySelector('button[type="submit"]').disabled = !isValid;
    root.querySelector("#save-rest-btn").disabled = !isValid;
  }
  await loadProfile();
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

  // 非同步載入草稿：優先讀取當日計畫，若無則讀取對應類型的最新目標記錄
  async function loadDraft() {
    draft = planDraft(player, date);
    const hasDailyPlan = player.dailyPlan?.localDate === date && player.dailyPlan.inputJson;

    if (!hasDailyPlan) {
      try {
        const profiles = await listTargetProfiles(player.id);
        
        //根據當前的 draft.training 決定要撈取哪種類型的範本
        const targetType = draft.training === "訓練日" ? "training" : "rest";
        const latestProfile = profiles
          .filter(p => p.trainingType === targetType)
          .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

        if (latestProfile && latestProfile.inputJson) {
          draft = {
            ...draft,
            ...latestProfile.inputJson,
            training: draft.training
          };
        }
      } catch (error) {
        console.error("讀取最新目標記錄失敗", error);
      }
    }
    draw();
  }

  function draw() {
    result = calculatePlan(draft);
    
    root.innerHTML = `<div class="planner-context"><label>球員<select id="target-player">${data.players.map((p) => `<option value="${p.id}" ${p.id === player.id ? "selected" : ""}>${esc(p.name)} #${p.number}</option>`).join("")}</select></label><span>${dirty ? `${date} · 尚有未儲存變更` : rangeNote(player, date)}</span></div>${athleteSummary(player)}<form id="nutrition-plan"><div class="planner-layout"><section class="panel planner-editor"><div class="plan-step"><span class="step-index">1</span><div><h2>決定總熱量</h2><div class="plan-fields">${numberField("calories", "每日熱量", draft.calories, "kcal", "1")}${numberField("weight", "計算體重", draft.weight, "kg")}</div><p class="plan-hint">這個體重只用來換算這一天的 g/kg，存在當日計畫裡，不會改球員基本資料。</p></div></div><div class="plan-step"><span class="step-index">2</span><div><h2>設定蛋白質</h2>${numberField("proteinKg", "每公斤體重", draft.proteinKg, "g/kg")}</div></div><div class="plan-step"><span class="step-index">3</span><div><h2>設定脂肪底線</h2><div class="plan-fields fat-fields">${numberField("fatValue", "脂肪底線", draft.fatValue, draft.fatUnit === "kg" ? "g/kg" : "%")}<label class="plan-field">計算方式<select name="fatUnit"><option value="kg" ${draft.fatUnit === "kg" ? "selected" : ""}>依體重 g/kg</option><option value="percent" ${draft.fatUnit === "percent" ? "selected" : ""}>依總熱量 %</option></select></label></div><p class="plan-hint">剩餘熱量自動分配給碳水。</p></div></div><div class="plan-step"><span class="step-index">4</span><div><h2>檢查訓練需求</h2><div class="plan-fields"><label class="plan-field">當日類型<select name="training">${["訓練日", "休息日"].map((x) => `<option ${draft.training === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>${numberField("carbMinimum", "碳水最低需求", draft.carbMinimum, "g/kg")}</div><p class="plan-hint">切換自動帶入：訓練日 6、休息日 4 g/kg，營養師可再調整。此為需求檢查值，實際碳水仍由剩餘熱量計算。</p></div></div><details class="manual-plan" ${draft.manual ? "open" : ""}><summary>手動微調營養素</summary><label class="manual-toggle"><input name="manual" type="checkbox" ${draft.manual ? "checked" : ""}> 啟用手動調整（保留熱量驗算）</label><div class="plan-fields manual-fields">${["protein", "fat", "carbs"].map((key, i) => numberField(key, ["蛋白質", "脂肪", "碳水"][i], draft.manual ? draft[key] : result.target?.[key] || 0, "g")).join("")}</div><p class="plan-hint">修改前面的分配條件後，會回到自動計算。</p></details></section><aside class="panel planner-summary"><div class="summary-heading"><span class="step-index">5</span><h2>驗算與確認</h2></div><div id="plan-results" aria-live="polite">${resultView(result)}</div><label class="plan-review" ${result.warnings.length ? "" : "hidden"}><input name="reviewed" type="checkbox"> 已檢查上述提醒，確認採用此目標</label><div class="form-error" role="alert"></div><button class="btn secondary" type="button" id="save-training-profile-btn" style="width: 100%; margin-bottom: 10px;">儲存為範本</button><button class="btn primary plan-save" type="submit">確認並儲存目標</button><p class="plan-hint">只為 ${date} 儲存 ${esc(player.name)} 的每日計畫。四項目標由系統重算，不會套到其他日期。</p></aside></div></form>`;

    root
      .querySelectorAll(".manual-fields input")
      .forEach((el) => (el.disabled = !draft.manual));
    root.querySelector(".plan-save").disabled = !result.valid;

    // 儲存為範本按鈕
    root.querySelector("#save-training-profile-btn")?.addEventListener("click", async (e) => {
      e.preventDefault(); 
      if (saving) return;

      const targetDayType = draft.training === "訓練日" ? "training" : "rest";
      const dayLabelName = draft.training;
      const errorBox = root.querySelector(".form-error");
      const reviewed = root.querySelector('[name="reviewed"]')?.checked || false;

      if (!result.valid) {
        if (errorBox) errorBox.textContent = result.errors.join(" ");
        return;
      }

      if (result.warnings.length && !reviewed) {
        if (errorBox) errorBox.textContent = "請先檢查提醒並勾選確認。";
        return;
      }

      saving = true;
      try {
        await saveTargetProfile(
          player.id,
          targetDayType,
          date,
          { ...draft, training: dayLabelName },
          reviewed
        );
        notify?.(`${dayLabelName}目標已儲存為範本`);
      } catch (error) {
        if (errorBox) errorBox.textContent = error.message;
      } finally {
        saving = false;
      }
    });
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

  root.addEventListener("change", async (e) => {
    if (e.target.id === "target-player") {
      player = data.players.find((p) => p.id === e.target.value);
      dirty = false;
      onPlayer(player.id);
      loadDraft();
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
        const newTypeLabel = e.target.value;
        draft = changePlanDay(draft, newTypeLabel);
        
        //切換選單時，動態去撈取新類型的範本來替換數字
        try {
          const profiles = await listTargetProfiles(player.id);
          const targetType = newTypeLabel === "訓練日" ? "training" : "rest";
          const latestProfile = profiles
            .filter(p => p.trainingType === targetType)
            .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

          if (latestProfile && latestProfile.inputJson) {
            draft = {
              ...draft,
              ...latestProfile.inputJson,
              training: newTypeLabel
            };
          }
        } catch (error) {
          console.error("切換類型時讀取記錄失敗", error);
        }
        
        // 使用 draw() 重新渲染整個表單，使熱量/營養素輸入框更新為新範本的數字
        draw();
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
  
  loadDraft();
}
