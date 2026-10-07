/**
 * 菜色 API。
 * 食物主檔、營養素與每 100 g 含量分開讀寫。
 */
import { collection } from "./api.js";
export const foods = collection("foods");
export const nutrients = collection("nutrients");
export const foodNutrients = collection("foodNutrients");
