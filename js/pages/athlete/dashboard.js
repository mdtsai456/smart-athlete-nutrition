/**
 * 球員首頁。
 */
import { startPage } from "../../core/app-shell.js";
import { view } from "../shared/screens.js";
startPage({
  role: "player",
  route: "dashboard",
  render: (pageState) => view("dashboard", pageState.data, "player", pageState.filter, pageState),
});
