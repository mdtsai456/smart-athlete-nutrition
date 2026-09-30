import { icon, button } from "../components/ui.js";
export function cameraView() {
  return `<section class="panel panel-padded"><div class="photo-placeholder">${icon("camera")}<strong>放上餐盤，記錄這一餐</strong><span>食物攝影機辨識 → 比對營養資料表 → 自動計算營養值</span></div><div class="data-row"><strong>辨識食物與重量</strong><span>由設備提供餐盤結果</span></div><div class="data-row"><strong>自動計算本餐營養</strong><span>熱量、蛋白質、脂肪、碳水</span></div><p class="notice">目前為模擬流程，尚未連接攝影機或 AI。</p><div class="actions">${button("開始記錄", "record", true)}</div></section>`;
}
