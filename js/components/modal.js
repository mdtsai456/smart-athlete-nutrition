/**
 * 對話框。
 * 各頁共用同一個 dialog。
 * 關閉時，焦點回到原本的按鈕。
 */
let lastFocus = null;
export function modal(title, body, wide = false) {
  const dialog = document.querySelector("#dialog");
  lastFocus = document.activeElement;
  dialog.className = wide ? "wide" : "";
  dialog.innerHTML = `<div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-action="close" aria-label="關閉">✕</button></div>${body}`;
  if (!dialog.open) dialog.showModal();
}
export function closeDialog() {
  const dialog = document.querySelector("#dialog");
  dialog.close();
  lastFocus?.focus();
}
