/** 將外部菜色編號對應本平台菜色。未知重量保留為 null，不建立營養數值。 */
import { recognizePhoto } from '../api/recognition.api.js';
export function matchRecognition(result, foods) {
  // 舊版 /api/predict 與新版 /api/v1/plate-recognitions 使用同一個餐點格式。
  const items = result.items || result.predictions?.map(item => ({
    detectedLabel: item.name, sourceFoodCode: item.dish_code, grams: null, bbox: item.bbox,
    alternative: item.alternative ? { detectedLabel: item.alternative.name, sourceFoodCode: item.alternative.dish_code } : null,
  }));
  const candidate = (item) => {
    if (!item || typeof item.detectedLabel !== 'string') throw new Error('辨識項目缺少菜名。');
    const code = item.sourceFoodCode == null ? '' : String(item.sourceFoodCode).trim();
    let matches = code ? foods.filter(food => String(food.sourceFoodCode ?? '').trim() === code) : [];
    if (!matches.length) matches = foods.filter(food => food.name.trim() === item.detectedLabel.trim());
    return {
      detectedLabel: item.detectedLabel,
      foodId: matches.length === 1 ? matches[0].id : null,

    };
  };
  return { ...result, succeeded: true, items: items.map(item => ({
    ...candidate(item),
    // bbox 使用原圖比例座標，供確認頁繪製辨識框。
    bbox: Array.isArray(item.bbox) && item.bbox.length === 4 && item.bbox.every(Number.isFinite)
      && item.bbox.every(value => value >= 0 && value <= 1) && item.bbox[2] > 0 && item.bbox[3] > 0 ? item.bbox : null,
    // alternative 是同一份食物的候選，不新增第二個餐點項目。
    alternative: item.alternative ? candidate(item.alternative) : null,
    grams: typeof item.grams === 'number' && Number.isFinite(item.grams) && item.grams > 0 ? item.grams : null,
  })) };
}
export async function analyzePhoto(file, foods, signal) {
  return matchRecognition(await recognizePhoto(file, signal), foods);
}
