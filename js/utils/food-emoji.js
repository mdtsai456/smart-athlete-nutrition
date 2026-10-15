/**
 * 同一分類使用同一個圖示。
 * 沒有對應分類時使用未分類圖示。
 * imageUrl 是可讀的圖片網址時，畫面使用該圖片。
 */
export const FOOD_CATEGORIES = [
  ["蛋白質", "🥩"],
  ["全穀雜糧", "🌾"],
  ["蔬菜", "🥦"],
  ["水果", "🍎"],
  ["乳品", "🥛"],
  ["油脂", "🫒"],
];
const CATEGORY_EMOJI = Object.fromEntries(FOOD_CATEGORIES);
export const UNCATEGORIZED_EMOJI = "🍽️";
const IMAGE_URL = /^(https?:\/\/|blob:|data:image\/(?:png|jpeg|webp);base64,|\/(?!\/))/i;

export function foodEmoji(food) {
  const category = food?.category || food?.foodType || "";
  return CATEGORY_EMOJI[category] || UNCATEGORIZED_EMOJI;
}

export function foodImageUrl(food) {
  const url = typeof food?.imageUrl === "string" ? food.imageUrl.trim() : "";
  return IMAGE_URL.test(url) ? url : "";
}
