/**
 * 球員個人資料。
 */
import { startPage } from "../../core/app-shell.js";
import { view } from "../shared/screens.js";
startPage({
  role: "player",
  route: "profile",
  render: (pageState) => view("profile", pageState.data, "player", pageState),
});
