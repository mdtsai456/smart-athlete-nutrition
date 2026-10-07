/**
 * 帳號與教練指派測試。
 * 停權帳號或停用組織不可登入。
 * 教練只可看指派開始日到結束日之間的球員。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { directory, signInError } from "../js/services/auth.service.js";
import { loadPage } from "../js/services/workspace.service.js";

test("suspended accounts and inactive organizations cannot sign in", async () => {
  const accounts = await directory();
  const suspended = accounts.find((account) => account.id === "acct-c-suspended");
  const inactiveOrg = accounts.find((account) => account.id === "acct-c-org2");
  const nutritionist = accounts.find((account) => account.id === "acct-n1");
  assert.equal(signInError(suspended), "這個帳號已停權，不能登入");
  assert.equal(signInError(inactiveOrg), "所屬組織已停用，不能登入");
  assert.equal(signInError(nutritionist), "");
  assert.equal(signInError(null), "找不到這個帳號");
});

test("coach visibility follows assignment start and end dates", async () => {
  const onDemoDay = await loadPage("2026-11-16", "acct-c1");
  const names = onDemoDay.players.map((player) => player.name);
  assert.equal(names.includes("林冠廷"), false);
  assert.equal(names.includes("王子豪"), false);
  assert.equal(onDemoDay.players.length, 6);
  assert.ok(onDemoDay.players.every((player) => player.coachName === "林志遠"));

  const beforeEnd = await loadPage("2026-10-15", "acct-c1");
  assert.equal(
    beforeEnd.players.some((player) => player.name === "林冠廷"),
    true,
  );
  assert.equal(
    beforeEnd.players.some((player) => player.name === "王子豪"),
    false,
  );

  const afterStart = await loadPage("2026-12-01", "acct-c1");
  assert.equal(
    afterStart.players.some((player) => player.name === "王子豪"),
    true,
  );
  assert.equal(
    afterStart.players.some((player) => player.name === "林冠廷"),
    false,
  );
});

test("nutritionist sees the organization and an athlete sees only self", async () => {
  const nutritionist = await loadPage("2026-11-16", "acct-n1");
  const athlete = await loadPage("2026-11-16", "acct-p1");
  assert.equal(nutritionist.players.length, 8);
  assert.equal(nutritionist.account.role, "nutritionist");
  assert.deepEqual(
    athlete.players.map((player) => player.id),
    ["p1"],
  );
  assert.equal(athlete.athleteId, "p1");
  assert.equal(athlete.organizationName, "男子籃球隊");
  const coachOf = (name) =>
    nutritionist.players.find((player) => player.name === name).coachName;
  assert.equal(coachOf("陳柏宇"), "林志遠");
  assert.equal(coachOf("林冠廷"), "未指派");
  assert.equal(coachOf("王子豪"), "未指派");
});
