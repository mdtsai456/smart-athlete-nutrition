/**
 * 球員飲食紀錄。
 * 與教練、營養師同一份清單。
 */
import { startPage } from "../../core/app-shell.js";
import { view } from "../shared/screens.js";
startPage({
  role: "player",
  route: "records",
  render: (pageState) => view("records", pageState.data, "player", pageState),
});
