/**
 * 飲食紀錄清單測試。
 * 項目全部刪除後，該餐不顯示。
 * 只剩拒絕項目的餐仍顯示，並標示已拒絕。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { view } from "../js/pages/shared/screens.js";

function record(patch) {
  return {
    id: "meal",
    playerId: "p1",
    player: { id: "p1", name: "陳柏宇" },
    date: "2026-11-16",
    time: "12:00",
    at: "2026-11-16T04:00:00.000Z",
    meal: "午餐",
    status: "submitted",
    statusLabel: "已送出",
    foodNames: "",
    nutrition: { calories: 0 },
    items: [],
    analysis: { statusLabel: "分析完成" },
    ...patch,
  };
}

test("records list drops a meal after every item is deleted", () => {
  const html = view(
    "records",
    {
      date: "2026-11-16",
      athleteId: "p1",
      records: [
        record({ id: "empty-lunch" }),
        record({
          id: "kept-breakfast",
          meal: "早餐",
          time: "08:00",
          status: "reviewed",
          statusLabel: "已審核",
          foodNames: "蛋",
          nutrition: { calories: 80 },
          items: [{ id: "i1", name: "蛋", confirmationStatus: "confirmed" }],
        }),
        record({
          id: "rejected-dinner",
          meal: "晚餐",
          time: "18:00",
          items: [{ id: "i2", name: "青菜", confirmationStatus: "rejected" }],
        }),
      ],
    },
    "nutritionist",
  );
  assert.equal(html.includes("empty-lunch"), false);
  assert.match(html, /kept-breakfast/);
  assert.match(html, /rejected-dinner/);
  assert.match(html, /青菜（已拒絕）/);
});

// 球員條件與餐別條件同時生效。清除餐別後恢復全部餐別。
for (const role of ['nutritionist', 'coach']) {
  test(`${role} combines player and multiple meal filters`, () => {
    const players = [{ id: 'p1', name: '甲' }, { id: 'p2', name: '乙' }];
    const data = {
      date: '2026-11-16', players,
      records: players.flatMap(player => ['早餐', '午餐', '晚餐'].map((meal, i) => record({
        id: `${player.id}-${i}`, playerId: player.id, player, meal, items: [{ id: 'item' }],
      }))),
    };
    const html = view('records', data, role, { recordPlayer: 'p2', recordMeals: ['早餐', '晚餐'] });
    assert.match(html, /data-id="p2-0"/);
    assert.match(html, /data-id="p2-2"/);
    assert.doesNotMatch(html, /data-id="p2-1"|data-id="p1-/);
    assert.match(view('records', data, role), /共 6 筆/);
    assert.match(view('records', data, role, { recordPlayer: 'missing' }), /沒有符合篩選條件/);
  });
}
