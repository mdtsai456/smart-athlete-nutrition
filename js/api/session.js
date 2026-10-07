/**
 * 登入 session。
 * Mock 使用 cookie。頁面不讀 session 內容。
 * 正式環境由瀏覽器送出 HttpOnly cookie。
 * JavaScript 只可讀 CSRF token。
 */
import { config, httpError, request } from "./api.js";
import { directory, signInError } from "../services/auth.service.js";

const SESSION_COOKIE = "fuelform_session";
const CSRF_COOKIE = "fuelform_csrf";
const SERVER_KEY = "fuelform-session-server";
let memoryJar = "";
let memoryServer = {};

function readJar() {
  if (typeof document !== "undefined" && typeof document.cookie === "string")
    return document.cookie;
  return memoryJar;
}
function writeCookie(name, value) {
  if (typeof document !== "undefined") {
    document.cookie = value
      ? `${name}=${value}; Path=/; SameSite=Lax`
      : `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  const parts = readJar()
    .split("; ")
    .filter((item) => item && !item.startsWith(`${name}=`));
  if (value) parts.push(`${name}=${value}`);
  memoryJar = parts.join("; ");
}
function readCookie(name) {
  const found = readJar()
    .split("; ")
    .find((item) => item.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}
function readServer() {
  if (typeof localStorage === "undefined") return memoryServer;
  try {
    return JSON.parse(localStorage.getItem(SERVER_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeServer(store) {
  if (typeof localStorage === "undefined") {
    memoryServer = store;
    return;
  }
  localStorage.setItem(SERVER_KEY, JSON.stringify(store));
}
function unauthorized() {
  return httpError(401, "尚未登入");
}
function publicAccount(account, csrfToken) {
  return {
    id: String(account.id),
    email: account.email,
    role: account.role,
    uiRole: account.uiRole,
    name: account.name,
    organizationName: account.organizationName,
    athleteId: account.athleteId ? String(account.athleteId) : null,
    csrfToken,
  };
}
export function csrfHeader() {
  const token = readCookie(CSRF_COOKIE);
  return token ? { "X-CSRF-Token": token } : {};
}
export async function assertMockWrite() {
  const session = await currentSession();
  const token = readCookie(CSRF_COOKIE);
  if (!token || token !== session.csrfToken) throw new Error("缺少驗證，請重新登入");
  return session;
}
export async function signIn(accountId) {
  if (config.mode !== "mock") {
    return request("/session", {
      method: "POST",
      body: { accountId },
    });
  }
  const account = (await directory()).find((item) => item.id === accountId);
  const error = signInError(account);
  if (error) throw new Error(error);
  const opaque = crypto.randomUUID();
  const csrfToken = crypto.randomUUID();
  const store = readServer();
  store[opaque] = { accountId: account.id, csrfToken };
  writeServer(store);
  writeCookie(SESSION_COOKIE, opaque);
  writeCookie(CSRF_COOKIE, csrfToken);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("accountId");
    sessionStorage.removeItem("role");
  }
  return publicAccount(account, csrfToken);
}
export async function currentSession() {
  if (config.mode !== "mock") return request("/session");
  const opaque = readCookie(SESSION_COOKIE);
  const record = opaque ? readServer()[opaque] : null;
  if (!record) throw unauthorized();
  const account = (await directory()).find((item) => item.id === record.accountId);
  if (!account || signInError(account)) throw unauthorized();
  return publicAccount(account, record.csrfToken);
}
