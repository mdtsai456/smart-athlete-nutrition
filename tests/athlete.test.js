/**
 * 運動員欄位、保存、自填範圍與文字跳脫。
 * 不開啟網頁。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { addPlayer, athleteFacts, athleteProfile, updateMyProfile, updatePlayer } from "../js/services/athlete.service.js";
import { loadPage } from "../js/services/workspace.service.js";
import { athleteDetails, athleteForm } from "../js/components/athlete-card.js";
const profile = {
  name: "A01",
  birthDate: "2000-02-29",
  sex: "女",
  height: "170",
  weight: "60",
  bodyFat: "",
  sport: "游泳",
  weeklyTraining: "0",
  goal: "維持",
  dietaryRestrictions: "素食",
  allergies: "牛奶",
  notes: "晚間訓練",
};
test("profile validates dates, required fields, measurements and optional body fat", () => {
  assert.equal(athleteProfile(profile).bodyFat, null);
  assert.equal(athleteProfile(profile).weeklyTraining, 0);
  for (const change of [
    { birthDate: "2001-02-29" },
    { birthDate: "2999-01-01" },
    { name: " " },
    { weight: "" },
    { weeklyTraining: 2.5 },
    { bodyFat: 100 },
    { sex: "invalid" },
    { goal: "invalid" },
  ])
    assert.throws(() => athleteProfile({ ...profile, ...change }));
});
test("profile updates persist for staff without overwriting goals or records", async () => {
  const before = await loadPage();
  const targets = before.players[0].nutritionTargets;
  await updatePlayer("p1", profile);
  const after = await loadPage();
  assert.equal(after.players[0].allergies, "牛奶");
  assert.equal(after.players[0].weight, 60);
  assert.equal(after.players[0].nutritionPlans, undefined);
  assert.deepEqual(after.players[0].nutritionTargets, targets);
  assert.deepEqual(after.players[0].target, before.players[0].target);
  assert.equal(after.records.length, before.records.length);
  assert.equal(after.players[1].name, before.players[1].name);
  const created = await addPlayer({ ...profile, bodyFat: "18.5" });
  assert.equal(created.bodyFat, 18.5);
  assert.equal(
    (await loadPage()).players.find((p) => p.id === created.id).sport,
    "游泳",
  );
});
test("legacy missing data remains unknown and profile content is escaped", () => {
  assert.ok(
    athleteFacts({}).some(
      ([key, value]) => key === "過敏" && value === "未填寫",
    ),
  );
  assert.ok(
    !athleteDetails({ notes: "<script>bad</script>" }).includes("<script>"),
  );
  assert.ok(athleteForm(profile).includes('name="birthDate"'));
});

test("self profile saves only demo player even when a different id is submitted", async () => {
  const before = await loadPage();
  await updateMyProfile({ ...profile, playerId: "p2", name: "球員自填", allergies: "花生" });
  const after = await loadPage();
  assert.equal(after.players[0].name, "球員自填");
  assert.equal(after.players[0].allergies, "花生");
  assert.deepEqual(after.players[1], before.players[1]);
});
test("profile navigation and form are available only in player view", async () => {
  const { allowed } = await import("../js/components/sidebar.js");
  const { view } = await import("../js/pages/shared/screens.js");
  assert.ok(allowed("player").some(([id]) => id === "profile"));
  for (const role of ["coach", "nutritionist"]) assert.ok(!allowed(role).some(([id]) => id === "profile"));
  const html = view("profile", await loadPage(), "player");
  assert.match(html, /data-form="my-profile"/);
  assert.match(html, /name="allergies"/);
  assert.match(html, /name="weeklyTraining"/);
});
