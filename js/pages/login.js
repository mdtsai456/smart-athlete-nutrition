/**
 * 登入頁。測試帳號已填好。
 * 帳號必須啟用。組織必須有效。
 */
import { startPage } from "../core/app-shell.js";
import { loginView } from "./shared/workflows.js";
startPage({
  route: "login",
  render: (pageState) => loginView(pageState.data?.directory || []),
});
