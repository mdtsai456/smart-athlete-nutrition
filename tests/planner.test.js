/**
 * 營養目標測試。
 * 測試營養分配、熱量驗算、需求提醒、依球員與日期儲存，以及舊版計畫。
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePlan,
  changePlanDay,
  confirmedPlan,
  planDraft,
  resolveTarget,
  weekDates,
} from "../js/services/target.service.js";
import { signIn } from "../js/api/session.js";
import { saveDayMarks, saveNutritionPlan, saveTargetTemplate } from "../js/api/plan.api.js";
import { loadPage } from "../js/services/workspace.service.js";
import { seed, today } from "../js/api/seed.js";
const example = {
  weight: 70,
  calories: 2800,
  proteinKg: 1.6,
  fatUnit: "kg",
  fatValue: 1,
  carbMinimum: 6,
  training: "訓練日",
  manual: false,
};
test("user example: 2800 kcal → 112 g protein, 70 g fat, 430.5 g carbs", () => {
  const p = calculatePlan(example);
  assert.deepEqual(p.target, {
    calories: 2800,
    protein: 112,
    fat: 70,
    carbs: 430.5,
  });
  assert.equal(p.energy, 2800);
  assert.equal(p.carbRate, 6.2);
  assert.equal(p.warnings.length, 0);
});
test("training and rest days use the same allocation without changing input budgets", () => {
  const training = calculatePlan(example);
  const rest = calculatePlan({ ...example, training: "休息日" });
  assert.deepEqual(rest.target, training.target);
});
test("fat percentage is converted from energy to grams", () => {
  const p = calculatePlan({ ...example, fatUnit: "percent", fatValue: 25 });
  assert.equal(p.target.fat, 77.8);
  assert.equal(p.target.carbs, 413);
  assert.ok(p.warnings.some((x) => x.includes("碳水")));
});
test("negative residual, zero weight, invalid day type and NaN cannot be saved", () => {
  for (const input of [
    { calories: 300 },
    { calories: 1000 },
    { weight: 0 },
    { weight: "abc" },
    { training: "比賽日" },
    { fatUnit: "percent", fatValue: 101 },
  ]) {
    assert.equal(calculatePlan({ ...example, ...input }).valid, false);
    assert.throws(() => confirmedPlan({ ...example, ...input }, true));
  }
});
test("manual fat below the floor requires explicit review", () => {
  const input = { ...example, manual: true, protein: 112, fat: 60, carbs: 453 };
  const p = calculatePlan(input);
  assert.ok(p.warnings.some((x) => x.includes("脂肪")));
  assert.throws(() => confirmedPlan(input, false));
  assert.equal(confirmedPlan(input, true).reviewed, true);
});
test("manual energy mismatch is blocked even with warning confirmation", () => {
  const input = { ...example, manual: true, protein: 112, carbs: 300, fat: 70 };
  assert.equal(calculatePlan(input).difference, -522);
  assert.throws(() => confirmedPlan(input, true));
});
test("manual rounding within 5 kcal is accepted", () => {
  const p = calculatePlan({
    ...example,
    manual: true,
    protein: 112,
    carbs: 431,
    fat: 70,
  });
  assert.equal(p.difference, 2);
  assert.equal(p.valid, true);
});
test("saving writes a daily plan and does not copy it onto other dates", async () => {
  await signIn("acct-n1");
  await saveNutritionPlan("p1", today, example);
  const data = await loadPage(today);
  const player = data.players.find((item) => item.id === "p1");
  assert.equal(player.target.carbs, 430.5);
  assert.equal(player.weight, 72);
  assert.equal(player.dailyPlan.inputJson.weight, 70);
  assert.equal(player.dailyPlan.inputJson.proteinKg, 1.6);
  assert.equal(player.target.source, "daily");
  assert.equal(
    (await loadPage("2026-11-17")).players.find((item) => item.id === "p1").target
      .calories,
    null,
  );
  assert.ok(
    data.players
      .filter((item) => item.id !== "p1")
      .every((item) => item.target.source === "unset"),
  );
  await saveNutritionPlan("p1", "2026-11-17", {
    ...example,
    training: "休息日",
    calories: 2400,
    carbMinimum: 4,
  });
  assert.equal(
    (await loadPage(today)).players.find((item) => item.id === "p1").target.calories,
    2800,
  );
  const next = await loadPage("2026-11-17");
  const nextPlayer = next.players.find((item) => item.id === "p1");
  assert.equal(nextPlayer.target.calories, 2400);
  const draft = planDraft(nextPlayer, "2026-11-17");
  assert.equal(draft.weight, 70);
  assert.equal(draft.proteinKg, 1.6);
  assert.equal(draft.carbMinimum, 4);
  assert.equal(draft.training, "休息日");
});

/** 用 p4。p1 在上一則測試已有當日計畫，當日計畫會蓋過範本。 */
test("a marked training day uses its template and a pending day stays unset", async () => {
  await signIn("acct-n1");
  await saveTargetTemplate("p4", "training", example, false);
  await saveTargetTemplate("p4", "rest", {
    ...example,
    training: "休息日",
    calories: 2400,
    carbMinimum: 4,
  }, false);
  await saveDayMarks("p4", [
    { localDate: today, dayType: "training" },
    { localDate: "2026-11-17", dayType: "pending" },
  ]);
  const trained = (await loadPage(today)).players.find((item) => item.id === "p4");
  assert.equal(trained.target.source, "template");
  assert.equal(trained.target.calories, 2800);
  assert.equal(trained.dailyPlan, null);
  const pending = (await loadPage("2026-11-17")).players.find((item) => item.id === "p4");
  assert.equal(pending.target.source, "unset");
  assert.equal(pending.target.calories, null);
  await saveTargetTemplate("p4", "training", { ...example, calories: 3000 }, false);
  const updated = (await loadPage(today)).players.find((item) => item.id === "p4");
  assert.equal(updated.target.calories, 3000);
  assert.equal(updated.target.source, "template");
  assert.equal(weekDates(today)[0], today);
});

test("overflowing calculations cannot produce an accepted target", () => {
  assert.equal(
    calculatePlan({ ...example, weight: 1e308, proteinKg: 20 }).valid,
    false,
  );
});

test("per-kg targets reopen from current weight without a saved body weight", () => {
  const player = {
    id: "p1",
    weight: 80,
    target: { calories: 2800, protein: 150, carbs: 374.5, fat: 78 },
    nutritionTargets: [
      ["energy", "absolute", 2800],
      ["protein", "per_kg_bw", 1.6],
      ["fat", "per_kg_bw", 1],
      ["carbohydrate", "absolute", 430.5],
    ].map(([nutrientId, targetBasis, targetMin]) => ({
      athleteId: "p1",
      nutrientId,
      targetBasis,
      targetMin,
      startDate: today,
      endDate: null,
    })),
  };
  const draft = planDraft(player, today);
  assert.equal(draft.weight, 80);
  assert.equal(draft.proteinKg, 1.6);
  assert.equal(draft.manual, false);
  assert.equal(resolveTarget(player, player.nutritionTargets, today).protein, 128);
});
test("absolute macro rows reopen as manual grams", () => {
  const target = { calories: 2800, protein: 112, fat: 74.7, carbs: 420 };
  const player = {
    id: "p1",
    weight: 70,
    target,
    nutritionTargets: [
      ["energy", "calories"],
      ["protein", "protein"],
      ["fat", "fat"],
      ["carbohydrate", "carbs"],
    ].map(([nutrientId, key]) => ({
      athleteId: "p1",
      nutrientId,
      targetBasis: "absolute",
      targetMin: target[key],
      startDate: today,
      endDate: null,
    })),
  };
  const draft = planDraft(player, today);
  assert.equal(draft.manual, true);
  assert.deepEqual(calculatePlan(draft).target, target);
});

test("day switch changes requirement and warning while preserving budget", () => {
  const training = { ...example, weight: 87 };
  const rest = changePlanDay(training, "休息日");
  assert.equal(rest.carbMinimum, 4);
  const a = calculatePlan(training),
    b = calculatePlan(rest);
  assert.equal(a.carbRequired, 522);
  assert.equal(b.carbRequired, 348);
  assert.equal(a.carbShortfall, 157);
  assert.equal(b.carbShortfall, 0);
  assert.equal(b.warnings.length, 0);
  assert.deepEqual(b.target, a.target);
  assert.equal(changePlanDay(rest, "訓練日").carbMinimum, 6);
  assert.equal(training.carbMinimum, 6);
});
test("carb check stays in the editor and is not stored on the nutrient rows", () => {
  const input = { ...changePlanDay(example, "休息日"), carbMinimum: 4.5 };
  const saved = confirmedPlan(input, false);
  assert.equal(saved.target.carbs, 430.5);
  assert.equal(input.carbMinimum, 4.5);
});

test("blank or nonnumeric inputs cannot silently become zero", () => {
  for (const value of ["", "  ", null, undefined, false, [], {}]) {
    assert.equal(calculatePlan({ ...example, carbMinimum: value }).valid, false);
    assert.equal(calculatePlan({ ...example, manual: true, protein: 112, fat: 70, carbs: value }).valid, false);
  }
  assert.equal(calculatePlan({ ...example, carbMinimum: 0 }).valid, true);
  assert.equal(calculatePlan({ ...example, carbMinimum: "0" }).valid, true);
});
