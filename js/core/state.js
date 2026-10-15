/**
 * 跨頁狀態。
 * 日期、球員選擇與分析區間存於 sessionStorage。
 * 文字搜尋只留在目前頁面。飲食紀錄篩選在載入頁面時還原。
 */
import { today } from "../api/seed.js";
export const state = {
  targetPlayer: sessionStorage.getItem("targetPlayer") || "p1",
  comparisonPlayer: sessionStorage.getItem("comparisonPlayer") || "p1",
  role: "nutritionist",
  date: sessionStorage.getItem("viewDate") || today,
  data: null,
  filter: "",
  recordPlayer: "",
  recordMeals: [],
  route: "",
  rangePreset: sessionStorage.getItem("rangePreset") || "7",
  rangeStart: sessionStorage.getItem("rangeStart") || "",
  rangeEnd: sessionStorage.getItem("rangeEnd") || "",
};
