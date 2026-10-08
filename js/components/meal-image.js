/**
 * 顯示餐盤影像。有後端影像網址時，顯示實拍照片。否則顯示低透明度的範例圖。
 * 示意圖僅供 UI 顯示，不寫入餐點資料或送交辨識。
 */
import { esc, icon } from "./ui.js";
export function mealImage(image, { compact = false } = {}) {
  // objectKey 是儲存識別碼，不能直接作為影像網址。後端須提供可讀取的 url。
  const url = typeof image?.url === "string" ? image.url.trim() : "";
  if (url && /^(https?:\/\/|blob:|data:image\/(?:png|jpeg|webp);base64,|\/(?!\/))/i.test(url))
    return `<img class="record-photo${compact ? " meal-image-thumb" : ""}" src="${esc(url)}" alt="實際拍攝的餐盤影像">`;
  if (compact)
    return `<div class="meal-image-thumb meal-image-placeholder" role="img" aria-label="餐盤範例圖，非實拍"><span>範例</span></div>`;
  return `<div class="photo-placeholder meal-image-placeholder">${icon("camera")}<strong>影像已另外存放</strong><span>${esc(image?.objectKey || "尚未上傳")}</span></div>`;
}
