/**
 * 現場餐秤站。不屬於單一角色。
 * 選好球員後，流程與食物攝影機相同。
 */
import { startPage } from "../core/app-shell.js";
import { view } from "./shared/screens.js";
startPage({
  route: "kiosk",
  render: (pageState) => view("kiosk", pageState.data, pageState.role, pageState.filter, pageState),
});
