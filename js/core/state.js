/**
 * 跨頁狀態。
 * 日期、帳號與篩選存在此工作階段。
 * 換頁時，sessionStorage 保留這些值。
 */
import { today } from "../api/seed.js";
export const state = {
  targetPlayer: sessionStorage.getItem("targetPlayer") || "p1",
  comparisonPlayer: sessionStorage.getItem("comparisonPlayer") || "p1",
  role: "nutritionist",
  date: sessionStorage.getItem("viewDate") || today,
  data: null,
  filter: "",
  route: "",
  rangePreset: sessionStorage.getItem("rangePreset") || "7",
  rangeStart: sessionStorage.getItem("rangeStart") || "",
  rangeEnd: sessionStorage.getItem("rangeEnd") || "",
};
