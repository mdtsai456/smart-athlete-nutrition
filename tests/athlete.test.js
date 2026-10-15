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
  const beforePlayer = before.players.find((player) => player.id === "p1");
  const targets = beforePlayer.nutritionTargets;
  await updatePlayer("p1", profile);
  const after = await loadPage();
  const afterPlayer = after.players.find((player) => player.id === "p1");
  assert.equal(afterPlayer.allergies, "牛奶");
  assert.equal(afterPlayer.weight, 60);
  assert.equal(afterPlayer.nutritionPlans, undefined);
  assert.deepEqual(afterPlayer.nutritionTargets, targets);
  assert.deepEqual(afterPlayer.target, beforePlayer.target);
  assert.equal(after.records.length, before.records.length);
  assert.equal(
    after.players.find((player) => player.id === "p2").name,
    before.players.find((player) => player.id === "p2").name,
  );
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
  const form = athleteForm(profile);
  const tag = (label, name) =>
    form.slice(form.indexOf(label), form.indexOf(">", form.indexOf(`name="${name}"`)) + 1);
  for (const [label, name] of [
    ["姓名或代號＊", "name"],
    ["出生日期＊", "birthDate"],
    ["生理性別＊", "sex"],
    ["身高（cm）＊", "height"],
    ["體重（kg）＊", "weight"],
    ["運動項目＊", "sport"],
    ["每週訓練次數＊", "weeklyTraining"],
    ["主要目標＊", "goal"],
  ]) {
    const field = tag(label, name);
    assert.ok(field.includes("＊"));
    assert.ok(field.includes("required"));
  }
  for (const [label, name] of [
    ["體脂率（%）", "bodyFat"],
    ["背號", "number"],
    ["位置", "position"],
    ["飲食限制", "dietaryRestrictions"],
    ["過敏", "allergies"],
    ["備註", "notes"],
  ]) {
    const field = tag(label, name);
    assert.equal(field.includes("選填"), false);
    assert.equal(field.includes("＊"), false);
    assert.equal(field.includes("required"), false);
  }
});

test("self profile saves only demo player even when a different id is submitted", async () => {
  const before = await loadPage();
  await updateMyProfile({ ...profile, playerId: "p2", name: "球員自填", allergies: "花生" });
  const after = await loadPage();
  const saved = after.players.find((player) => player.id === "p1");
  assert.equal(saved.name, "球員自填");
  assert.equal(saved.allergies, "花生");
  assert.deepEqual(
    after.players.find((player) => player.id === "p2"),
    before.players.find((player) => player.id === "p2"),
  );
});
test("player lists sort jersey numbers numerically and put blanks last", async () => {
  const two = await addPlayer({ ...profile, name: "二號", number: 2 });
  const ten = await addPlayer({ ...profile, name: "十號", number: 10 });
  const blank = await addPlayer({ ...profile, name: "無背號", number: "" });
  const players = (await loadPage()).players;
  const ids = players.map((player) => player.id);
  assert.ok(ids.indexOf(two.id) < ids.indexOf(ten.id));
  assert.ok(ids.indexOf(ten.id) < ids.indexOf(blank.id));
  const numbers = players.map((player) =>
    player.number === "" || player.number == null ? null : Number(player.number),
  );
  const firstBlank = numbers.indexOf(null);
  const present = firstBlank === -1 ? numbers : numbers.slice(0, firstBlank);
  assert.deepEqual(present, [...present].sort((a, b) => a - b));
  if (firstBlank !== -1)
    assert.ok(numbers.slice(firstBlank).every((value) => value == null));
});
test("profile navigation and form are available only in player view", async () => {
  const { allowed } = await import("../js/components/sidebar.js");
  const { view } = await import("../js/pages/shared/screens.js");
  assert.ok(allowed("player").some(([id]) => id === "profile"));
  for (const role of ["coach", "nutritionist"]) assert.ok(!allowed(role).some(([id]) => id === "profile"));
  const html = view("profile", await loadPage(), "player");
  assert.match(html, /data-form="my-profile"/);
  assert.match(html, /name="allergies"/);
  assert.match(html, /＊為必填/);
});
