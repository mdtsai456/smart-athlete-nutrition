/**
 * 營養數字的畫面格式。
 * 不改計算結果。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { percent, shown } from "../js/components/ui.js";

test("nutrition text groups thousands and keeps the original decimals", () => {
  assert.equal(shown(2800), "2,800");
  assert.equal(shown(120.5), "120.5");
  assert.equal(shown(120.54), "120.54");
  assert.equal(shown(0), "0");
  assert.equal(shown(null), "未設定");
  assert.equal(percent(80), "80%");
  assert.equal(percent(80.5), "80.5%");
  assert.equal(percent(null), "未設定");
});
