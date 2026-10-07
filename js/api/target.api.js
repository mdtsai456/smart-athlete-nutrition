/**
 * 營養目標 API。
 * 目標依營養素與生效日期區間存放。
 * 此 API 不存放當日合計。
 */
import { collection } from "./api.js";
export const nutritionTargets = collection("nutritionTargets");
