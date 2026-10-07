/**
 * 教練營養分析。
 * 含時間區段與當日達成。
 */
import { startPage } from "../../core/app-shell.js";
import { view } from "../shared/screens.js";
startPage({
  role: "coach",
  route: "analysis",
  render: (pageState) => view("analysis", pageState.data, "coach", pageState.filter, pageState),
});
