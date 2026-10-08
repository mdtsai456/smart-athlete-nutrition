/** 餐點 HTTP 命令測試。確認項目時只呼叫餐點 API，不查詢 Mock 資料表。 */
import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../js/api/api.js";
import { confirmMealItem, finishMealAnalysis } from "../js/api/meal.api.js";

test("HTTP confirmation uses one meal mutation request", async () => {
  const previousMode = config.mode;
  const previousFetch = globalThis.fetch;
  const calls = [];
  try {
    config.mode = "http";
    globalThis.fetch = async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return new Response(JSON.stringify({ mealId: "m1", revision: 3 }));
    };
    const result = await confirmMealItem("m1", "i1", { weightG: 100 }, 2);
    assert.equal(result.revision, 3);
    assert.deepEqual(calls, [{ url: "/api/v1/meals/m1/mutations", body: {
      action: "confirm", expectedRevision: 2, payload: { itemId: "i1", weightG: 100 },
    } }]);
    await assert.rejects(() => finishMealAnalysis("m1"), /正式模式/);
    assert.equal(calls.length, 1);
  } finally {
    config.mode = previousMode;
    globalThis.fetch = previousFetch;
  }
});
