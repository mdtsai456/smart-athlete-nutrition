import test from "node:test";
import assert from "node:assert/strict";
import { athleteProfile, athleteFacts } from "../js/services/athlete.js";
import { platform } from "../js/services/platform.js";
import { athleteDetails, athleteForm } from "../js/components/athlete.js";
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
  const before = await platform.load();
  const plan = before.players[0].nutritionPlans;
  await platform.updatePlayer("p1", profile);
  const after = await platform.load();
  assert.equal(after.players[0].allergies, "牛奶");
  assert.equal(after.players[0].weight, 60);
  assert.deepEqual(after.players[0].nutritionPlans, plan);
  assert.deepEqual(after.players[0].target, before.players[0].target);
  assert.equal(after.records.length, before.records.length);
  assert.equal(after.players[1].name, before.players[1].name);
  const created = await platform.addPlayer({ ...profile, bodyFat: "18.5" });
  assert.equal(created.bodyFat, 18.5);
  assert.equal(
    (await platform.load()).players.find((p) => p.id === created.id).sport,
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
  const before = await platform.load();
  await platform.updateMyProfile({ ...profile, playerId: "p2", name: "球員自填", allergies: "花生" });
  const after = await platform.load();
  assert.equal(after.players[0].name, "球員自填");
  assert.equal(after.players[0].allergies, "花生");
  assert.deepEqual(after.players[1], before.players[1]);
});
test("profile navigation and form are available only in player view", async () => {
  const { allowed, view } = await import("../js/pages/views.js");
  assert.ok(allowed("player").some(([id]) => id === "profile"));
  for (const role of ["coach", "nutritionist"]) assert.ok(!allowed(role).some(([id]) => id === "profile"));
  const html = view("profile", await platform.load(), "player");
  assert.match(html, /data-form="my-profile"/);
  assert.match(html, /name="allergies"/);
  assert.match(html, /name="weeklyTraining"/);
});
