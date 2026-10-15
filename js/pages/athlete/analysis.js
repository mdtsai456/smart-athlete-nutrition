/**
 * 球員營養分析。只顯示時間區段統計。
 */
import { startPage } from "../../core/app-shell.js";
import { view } from "../shared/screens.js";
startPage({
  role: "player",
  route: "analysis",
  render: (pageState) => view("analysis", pageState.data, "player", pageState),
});
