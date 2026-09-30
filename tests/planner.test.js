import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePlan,
  changePlanDay,
  confirmedPlan,
  planDraft,
} from "../js/services/planner.js";
import { platform } from "../js/services/platform.js";
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
test("saving isolates player/date and reloads exact draft and target", async () => {
  await platform.saveNutritionPlan("p1", today, example);
  const data = await platform.load(today);
  assert.equal(data.players[0].target.carbs, 430.5);
  assert.deepEqual(data.players[0].nutritionPlans[today].input, example);
  assert.notEqual(data.players[1].target.carbs, 430.5);
  const other = await platform.load("2026-11-17");
  assert.notEqual(other.players[0].target.carbs, 430.5);
  await platform.saveNutritionPlan("p1", "2026-11-17", {
    ...example,
    training: "休息日",
    calories: 2400,
    carbMinimum: 4,
  });
  assert.equal((await platform.load(today)).players[0].target.carbs, 430.5);
});

test("overflowing calculations cannot produce an accepted target", () => {
  assert.equal(
    calculatePlan({ ...example, weight: 1e308, proteinKg: 20 }).valid,
    false,
  );
});

test("legacy rest labels migrate without changing saved inputs", () => {
  const player = {
    nutritionPlans: {
      [today]: {
        input: {
          ...example,
          mode: "body",
          carbsKg: 6,
          training: "休息／體態日",
        },
      },
    },
  };
  const draft = planDraft(player, today);
  assert.equal(draft.training, "休息日");
  assert.equal("mode" in draft, false);
  assert.equal("carbsKg" in draft, false);
  assert.equal(draft.calories, 2800);
});
test("legacy performance targets remain intact when reopening", () => {
  const target = { calories: 2800, protein: 112, fat: 74.7, carbs: 420 };
  const player = {
    nutritionPlans: {
      [today]: {
        input: {
          ...example,
          mode: "performance",
          carbsKg: 6,
          training: "比賽日",
        },
        target,
      },
    },
  };
  const draft = planDraft(player, today);
  assert.equal(draft.training, "訓練日");
  assert.equal(draft.manual, true);
  assert.deepEqual(calculatePlan(draft).target, target);
  assert.equal("mode" in draft, false);
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
test("custom day requirement survives saving and reopening", () => {
  const input = { ...changePlanDay(example, "休息日"), carbMinimum: 4.5 };
  const saved = confirmedPlan(input, false);
  const draft = planDraft({ nutritionPlans: { [today]: saved } }, today);
  assert.equal(draft.carbMinimum, 4.5);
  assert.equal(calculatePlan(draft).carbRequired, 315);
});
