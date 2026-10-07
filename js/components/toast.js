/**
 * 短暫提示。顯示 3.5 秒。
 */
export function toast(message) {
  const el = document.querySelector("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 3500);
}
