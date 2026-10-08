/**
 * 跨頁狀態。
 * 日期、球員選擇與分析區間存於 sessionStorage。
 * 文字搜尋與飲食紀錄篩選只保留於目前頁面。
 */
import { today } from "../api/seed.js";
export const state = {
  targetPlayer: sessionStorage.getItem("targetPlayer") || "p1",
  comparisonPlayer: sessionStorage.getItem("comparisonPlayer") || "p1",
  role: "nutritionist",
  date: sessionStorage.getItem("viewDate") || today,
  data: null,
  filter: "",
  // 飲食紀錄篩選只保留於目前頁面。重新載入後重設。
  // 空字串表示全部球員；空陣列表示全部餐別。
  recordPlayer: "",
  recordMeals: [],
  route: "",
  rangePreset: sessionStorage.getItem("rangePreset") || "7",
  rangeStart: sessionStorage.getItem("rangeStart") || "",
  rangeEnd: sessionStorage.getItem("rangeEnd") || "",
};
