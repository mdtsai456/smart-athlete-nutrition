/**
 * 營養師飲食紀錄。
 * 可審核與修正。
 */
import { startPage } from "../../core/app-shell.js";
import { view } from "../shared/screens.js";
startPage({
  role: "nutritionist",
  route: "records",
  render: (pageState) => view("records", pageState.data, "nutritionist", pageState.filter, pageState),
});
