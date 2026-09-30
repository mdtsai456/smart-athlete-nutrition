import { seed } from "./seed.js";
// HTTP 與 Mock 共用 request 契約；正式串接只調整此層及 Service，不在 UI 寫 fetch。
export const config = { mode: "mock", baseURL: "/api/v1" };
let memory;
const key = "fuelform-demo-v1";
// 優先保留瀏覽器已有資料；seed 僅用於第一次啟動，不覆寫使用者紀錄。
function read() {
  if (memory) return memory;
  try {
    memory = JSON.parse(globalThis.localStorage?.getItem?.(key) || "null");
  } catch {}
  return (memory ||= structuredClone(seed));
}
function save(db) {
  globalThis.localStorage?.setItem?.(key, JSON.stringify(db));
  memory = db;
}
export async function request(path, { method = "GET", body } = {}) {
  if (config.mode !== "mock") {
    const response = await fetch(`${config.baseURL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error("資料讀取失敗，請稍後重試");
    return response.json();
  }
  await new Promise((r) => setTimeout(r, 120));
  if (path === "/camera/recognitions" && method === "POST") {
    return {
      source: "食物攝影機（模擬辨識）",
      modelVersion: null,
      recognitionId: globalThis.crypto.randomUUID(),
      items: [
        { foodId: "f1", grams: 180, confidence: 92 },
        { foodId: "f2", grams: 250, confidence: 96 },
        { foodId: "f3", grams: 150, confidence: 85 },
      ],
    };
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
  } else throw new Error("不支援的操作");
  save(next);
  return structuredClone(result);
}
