/**
 * 教練飲食紀錄。
 * 教練不能改餐點。
 */
import { startPage } from "../../core/app-shell.js";
import { view } from "../shared/screens.js";
startPage({
  role: "coach",
  route: "records",
  render: (pageState) => view("records", pageState.data, "coach", pageState.filter, pageState),
});
