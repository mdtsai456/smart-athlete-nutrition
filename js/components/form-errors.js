/**
 * 【表單錯誤定位】新增檔案：放到 js/components/form-errors.js
 * 表單錯誤定位。
 * - 在欄位旁顯示原因，不重新渲染表單，所以已填內容保留
 * - 焦點移到畫面上第一個錯誤欄位
 * - 使用者修改該欄位後，錯誤自動消失
 * - 驗證規則直接讀欄位上的 required / min / max / step / pattern，
 *   不需要在這裡重複寫欄位名稱
 */

const fieldLabel = (el) => {
  const wrap = el.closest(".field") || el.closest("label");
  if (!wrap) return el.name || "此欄位";
  const copy = wrap.cloneNode(true);
  copy.querySelectorAll("input,select,textarea,small,.field-error").forEach((n) => n.remove());
  return copy.textContent.trim().replace(/[（(].*?[）)]/g, "").trim() || el.name || "此欄位";
};

function messageFor(el) {
  const v = el.validity;
  const label = fieldLabel(el);
  const isChoice = el.tagName === "SELECT" || el.type === "radio" || el.type === "checkbox";
  if (v.valueMissing) return isChoice ? `請選擇${label}` : `請輸入${label}`;
  if (v.typeMismatch) return `${label}格式不正確`;
  if (v.patternMismatch) return el.title || `${label}格式不正確`;
  if (v.rangeUnderflow) return `${label}不可小於 ${el.min}`;
  if (v.rangeOverflow)
    return el.type === "date" ? `${label}不可晚於今天` : `${label}不可大於 ${el.max}`;
  if (v.stepMismatch)
    return el.step === "1" || !el.step ? `${label}請輸入整數` : `${label}請輸入有效的數值（間距 ${el.step}）`;
  if (v.tooShort) return `${label}至少需要 ${el.minLength} 個字`;
  if (v.tooLong) return `${label}最多 ${el.maxLength} 個字`;
  if (v.badInput) return `${label}請輸入數字`;
  return el.validationMessage || `${label}有誤`;
}

/** 回傳 { 欄位名: 錯誤訊息 }，空物件代表通過。 */
export function validateForm(form) {
  const errors = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled || el.willValidate === false) continue;
    if (errors[el.name]) continue;
    // 只有空白的必填文字欄位，視同未填
    if (el.required && typeof el.value === "string" && el.value !== "" && !el.value.trim()) {
      errors[el.name] = `請輸入${fieldLabel(el)}`;
      continue;
    }
    if (el.validity.valid) continue;
    errors[el.name] = messageFor(el);
  }
  return errors;
}

export function clearFormErrors(form) {
  form.querySelectorAll(".field-error").forEach((n) => n.remove());
  form.querySelectorAll("[aria-invalid]").forEach(clearMarks);
  const summary = form.querySelector(".form-error");
  if (summary) summary.textContent = "";
}

function clearMarks(el) {
  el.removeAttribute("aria-invalid");
  el.removeAttribute("aria-describedby");
  el.classList.remove("has-error");
}

/**
 * @param {HTMLFormElement} form
 * @param {Record<string,string>} errors
 * @returns {boolean} 有錯誤（並已把焦點移過去）
 */
export function showFormErrors(form, errors) {
  clearFormErrors(form);
  const targets = [];
  for (const [name, message] of Object.entries(errors || {})) {
    const found = form.elements[name];
    const el = found instanceof RadioNodeList ? found[0] : found;
    if (el) targets.push({ name, message, el });
  }
  if (!targets.length) return false;

  // 依畫面順序，確保「第一個錯誤」是最上面的欄位
  targets.sort((a, b) =>
    a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );

  for (const { name, message, el } of targets) {
    const id = `err-${name}`;
    const p = document.createElement("p");
    p.className = "field-error";
    p.id = id;
    p.textContent = message;
    (el.closest(".field") || el.parentElement).appendChild(p);
    el.setAttribute("aria-invalid", "true");
    el.setAttribute("aria-describedby", id);
    el.classList.add("has-error");
    const onEdit = () => {
      p.remove();
      clearMarks(el);
    };
    el.addEventListener("input", onEdit, { once: true });
    el.addEventListener("change", onEdit, { once: true });
  }

  const summary = form.querySelector(".form-error");
  if (summary) summary.textContent = `有 ${targets.length} 個欄位需要修正`;

  const first = targets[0].el;
  first.scrollIntoView({ block: "center", behavior: "smooth" });
  first.focus({ preventScroll: true });
  return true;
}