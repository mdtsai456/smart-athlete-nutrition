/**
 * 登入。
 * 身分只來自後端 session。
 * 瀏覽器不把帳號編號存成登入憑證。
 */
import { signIn } from "../api/session.js";
import { homeRoute, pageUrl } from "./router.js";
export async function enterAccount(accountId) {
  const account = await signIn(accountId);
  location.assign(pageUrl(account.uiRole, homeRoute(account.uiRole)));
}
