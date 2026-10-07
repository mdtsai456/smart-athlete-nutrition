/**
 * 組織、帳號、球員、營養師、教練與指派。
 * 頁面不自己組網址。
 */
import { collection } from "./api.js";
export const organizations = collection("organizations");
export const accounts = collection("accounts");
export const players = collection("players");
export const nutritionists = collection("nutritionists");
export const coaches = collection("coaches");
export const athleteCoaches = collection("athleteCoaches");
