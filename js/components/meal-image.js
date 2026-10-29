/**
 * 顯示餐盤影像。有後端影像網址時，顯示實拍照片。否則顯示低透明度的範例圖。
 * 示意圖僅供 UI 顯示，不寫入餐點資料或送交辨識。
 */
import { esc, icon } from "./ui.js";
export function mealImage(image, { compact = false, annotated = false, items = [] } = {}) {
  // objectKey 是儲存識別碼。objectKey 不是影像網址。後端提供可讀取的 url。
  const validUrl = value => typeof value === "string" && /^(https?:\/\/|blob:|data:image\/(?:png|jpeg|webp);base64,|\/(?!\/))/i.test(value.trim());
  // 框的位置以原圖為基準。圖片保持比例，避免框與食物錯位。
  const regions = items.filter(item => Array.isArray(item.bbox) && item.bbox.length === 4
    && item.bbox.every(value => Number.isFinite(value) && value >= 0 && value <= 1)
    && item.bbox[2] > 0 && item.bbox[3] > 0);
  if (annotated && regions.length && validUrl(image?.url)) {
    const colors = ["#b52d36", "#929b19", "#238c40", "#343bb1", "#9431aa", "#188e98"];
    return `<div class="recognition-photo"><img src="${esc(image.url)}" alt="餐盤照片與食物辨識框">${regions.map((item, index) => {
      const [x, y, width, height] = item.bbox;
      return `<div class="recognition-box" style="left:${x * 100}%;top:${y * 100}%;width:${Math.min(width, 1 - x) * 100}%;height:${Math.min(height, 1 - y) * 100}%;--box-color:${colors[index % colors.length]}"><span>${esc(item.name || item.detectedLabel)}</span></div>`;
    }).join("")}</div>`;
  }
  const boxed = annotated && validUrl(image?.annotatedUrl);
  const url = boxed ? image.annotatedUrl.trim() : (typeof image?.url === "string" ? image.url.trim() : "");
  if (url && /^(https?:\/\/|blob:|data:image\/(?:png|jpeg|webp);base64,|\/(?!\/))/i.test(url))
    return `<img class="record-photo${compact ? " meal-image-thumb" : ""}" src="${esc(url)}" ${boxed && validUrl(image?.url) ? `data-original-src="${esc(image.url)}"` : ""} alt="${boxed ? "餐盤辨識框選結果" : "實際拍攝的餐盤影像"}">`;
  if (compact)
    return `<div class="meal-image-thumb meal-image-placeholder" role="img" aria-label="餐盤範例圖，非實拍"><span>範例</span></div>`;
  return `<div class="photo-placeholder meal-image-placeholder">${icon("camera")}<strong>影像已另外存放</strong><span>${esc(image?.objectKey || "尚未上傳")}</span></div>`;
}
