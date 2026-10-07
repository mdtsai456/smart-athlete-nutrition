/**
 * 教練首頁。
 * 名單只含所選日期在指派期間內的球員。
 */
import { startPage } from "../../core/app-shell.js";
import { view } from "../shared/screens.js";
startPage({
  role: "coach",
  route: "dashboard",
  render: (pageState) => view("dashboard", pageState.data, "coach", pageState.filter, pageState),
});
