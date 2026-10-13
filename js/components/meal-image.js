/**
 * 顯示餐盤影像。有後端影像網址時，顯示實拍照片。否則顯示低透明度的範例圖。
 * 示意圖僅供 UI 顯示，不寫入餐點資料或送交辨識。
 */
import { esc, icon } from "./ui.js";

export function mealImage(image, { compact = false } = {}) {
  // objectKey 是儲存識別碼，不能直接作為影像網址。後端須提供可讀取的 url。
  const url = typeof image?.url === "string" ? image.url.trim() : "";
    // 只接受專案原本允許的圖片網址格式。
  const validUrl =
    url &&
    //設定允許的圖片網址格式：
    /^(https?:\/\/|blob:|data:image\/(?:png|jpeg|webp);base64,|\/(?!\/))/i.test(url);
  if (validUrl) {
    // 修改重點 1：
    // 用外層容器包住實拍圖與備用範例圖，方便在載入失敗時切換。
    // compact=true 時保留原本的縮圖樣式。
    return `
      <div class="meal-image-fallback-wrap${compact ? " compact" : ""}">
        <img
          class="record-photo${compact ? " meal-image-thumb" : ""}"
          src="${esc(url)}"
          alt="實際拍攝的餐盤影像"
          onerror="
            this.hidden = true;
            this.nextElementSibling.hidden = false;
          "
        >

        <!-- 修改重點 2：
             實拍圖載入失敗後，隱藏破圖的 img，顯示這個備用區塊。 -->
        <div class="meal-image-fallback" hidden>
          <img
            class="meal-image-thumb"
            src="/assets/images/meal-preview.png"
            alt="範例圖，非實拍"
          >

          <!-- 依需求明確告知使用者照片載入失敗。 -->
          <span class="meal-image-error-text">照片無法載入</span>

          <!-- 明確標示範例圖不是使用者實際拍攝的照片。 -->
          <small>範例圖，非實拍</small>
        </div>
      </div>
    `;
  }

  // 修改重點 3：
  // 沒有有效圖片網址時，也顯示範例圖，不再只顯示原本的佔位文字。
  if (compact) {
    return `
      <div class="meal-image-fallback-wrap compact">
        <div class="meal-image-fallback">
          <img
            class="meal-image-thumb"
            src="/assets/images/meal-preview.png"
            alt="範例圖，非實拍"
          >
          <small>範例圖，非實拍</small>
        </div>
      </div>
    `;
  }

  // 非縮圖模式：顯示範例圖、載入狀態與非實拍說明。
  return `
    <div class="meal-image-fallback-wrap">
      <div class="meal-image-fallback">
        <img
          class="record-photo"
          src="/assets/images/meal-preview.png"
          alt="範例圖，非實拍"
        >
        <strong>照片無法載入</strong>
        <small>範例圖，非實拍</small>
      </div>
    </div>
  `;}
