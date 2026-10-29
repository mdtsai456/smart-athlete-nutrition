/** 短暫提示。對話框開啟時，在框內置頂顯示；最後一次提示保留 3.5 秒。 */
let timer;
export function toast(message) {
  let el = document.querySelector("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
  }
  clearTimeout(timer);
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = message;
  const dialog = document.querySelector("dialog[open]");
  // 提示放進 modal 的最上層內容，不與頁面背景競爭 z-index。
  el.classList.toggle("dialog-toast", !!dialog);
  if (dialog) {
    dialog.prepend(el);
    el.hidden = false;
    el.classList.add("visible");
    el.scrollIntoView({ block: "nearest" });
  } else {
    document.body.append(el);
    el.hidden = false;
    el.classList.add("visible");
  }
  timer = setTimeout(() => {
    el.classList.remove("visible");
    el.hidden = true;
  }, 3500);
}
