/**
 * HTTP 與 Mock 共用 request。
 * 模擬資料存在瀏覽器。UI 不呼叫 fetch。
 * 正式連線只改這裡與 Service。
 */
import { seed } from "./seed.js";
export const config = { mode: "mock", baseURL: "/api/v1" };
let memory;
const key = "fuelform-demo-v4";
// 若瀏覽器已有資料，使用該資料。seed 只在第一次啟動寫入，不覆蓋使用者紀錄。
function read() {
  if (memory) return memory;
  try {
    memory = JSON.parse(globalThis.localStorage?.getItem?.(key) || "null");
  } catch {}
  memory ||= structuredClone(seed);
  if (!Array.isArray(memory.dailyPlans)) memory.dailyPlans = [];
  if (!Array.isArray(memory.mealRevisions)) memory.mealRevisions = [];
  if (!Array.isArray(memory.targetProfiles)) {
  memory.targetProfiles = [];
  }
  return memory;
}
function save(db) {
  globalThis.localStorage?.setItem?.(key, JSON.stringify(db));
  memory = db;
}
export function collection(name) {
  return {
    list: () => request("/" + name),
    get: (id) => request(`/${name}/${id}`),
    create: (body) => request("/" + name, { method: "POST", body }),
    update: (id, body) => request(`/${name}/${id}`, { method: "PATCH", body }),
    remove: (id) => request(`/${name}/${id}`, { method: "DELETE" }),
  };
}
export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
export async function request(path, { method = "GET", body, headers = {} } = {}) {
  if (config.mode !== "mock") {
    const response = await fetch(`${config.baseURL}${path}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401) throw httpError(401, "尚未登入");
    if (response.status === 409) {
      let payload = {};
      try {
        payload = await response.json();
      } catch {}
      const error = httpError(
        409,
        payload.code === "REVISION_CONFLICT"
          ? "此餐點已被其他人更新，請重新載入。"
          : "資料已更新，請重新讀取",
      );
      error.code = payload.code || null;
      error.currentRevision = payload.currentRevision ?? null;
      throw error;
    }
    if (!response.ok) throw new Error("資料讀取失敗，請稍後重試");
    if (response.status === 204) return null;
    return response.json();
  }
  const [resource, id] = path.replace(/^\//, "").split("/");
  const db = read();
  if (!Array.isArray(db[resource])) throw new Error("找不到資料");
  if (method === "GET")
    return structuredClone(
      id ? db[resource].find((x) => x.id === id) : db[resource],
    );
  const next = structuredClone(db);
  let result;
  if (method === "POST") {
    result = { ...body, id: globalThis.crypto.randomUUID() };
    next[resource].push(result);
  } else if (method === "PATCH") {
    const index = next[resource].findIndex((x) => x.id === id);
    if (index < 0) throw new Error("找不到資料");
    result = { ...next[resource][index], ...body };
    next[resource][index] = result;
  } else if (method === "DELETE") {
    const index = next[resource].findIndex((x) => x.id === id);
    if (index < 0) throw new Error("找不到資料");
    result = next[resource][index];
    next[resource].splice(index, 1);
  } else throw new Error("不支援的操作");
  save(next);
  return structuredClone(result);
}
