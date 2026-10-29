/**
 * 營養師菜色資料庫。
 */
import { startPage } from "../../core/app-shell.js?v=20261029";
import { view } from "../shared/screens.js";
startPage({
  role: "nutritionist",
  route: "foods",
  render: (pageState) => view("foods", pageState.data, "nutritionist", pageState),
});
