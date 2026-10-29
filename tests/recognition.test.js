/** 驗證照片上傳、兩版辨識格式、未知重量及餐點確認流程。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { recognizePhoto, validatePhoto } from '../js/api/recognition.api.js';
import { mealImage } from '../js/components/meal-image.js';
import { matchRecognition } from '../js/services/recognition.service.js';
import { signIn } from '../js/api/session.js';
import { openDraftMeal, attachMealImage, queueMealAnalysis, finishMealAnalysis, confirmMealItem, readMeal } from '../js/api/meal.api.js';

test('photo upload uses multipart and preserves the stored photo URL', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8000/api/predict');
    assert.equal(options.method, 'POST');
    assert.equal(options.body.get('file').name, 'plate.png');
    assert.equal(options.headers, undefined);
    return Response.json({ predictions: [], model: 'test', result_dir: 'test-result' });
  });
  const result = await recognizePhoto(new Blob(['image'], { type: 'image/png' }));
  assert.equal(result.image.url, 'http://127.0.0.1:8000/uploads/test-result/original.png');
});

test('invalid files and failed API responses are rejected', async t => {
  assert.throws(() => validatePhoto(new Blob(['x'], { type: 'text/plain' })), /JPG/);
  assert.throws(() => validatePhoto(new Blob([], { type: 'image/jpeg' })), /不可為空/);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ errorMessage: '模型失敗' }, { status: 502 }));
  await assert.rejects(recognizePhoto(new Blob(['x'], { type: 'image/jpeg' })), /模型失敗/);
});

test('source codes match uniquely and no weight is invented', () => {
  const foods = [{ id: 'f1', name: '雞肉', sourceFoodCode: '17' }, { id: 'f2', name: '飯' }, { id: 'f3', name: '飯' }];
  const result = matchRecognition({ predictions: [{ name: '雞胸肉', dish_code: 17 }, { name: '飯' }, { name: '未知菜' }] }, foods);
  assert.deepEqual(result.items.map(x => x.foodId), ['f1', null, null]);
  assert.ok(result.items.every(x => x.grams === null));
  assert.equal(matchRecognition({ succeeded: true, items: [{ detectedLabel: '雞肉', grams: null }] }, foods).items[0].foodId, 'f1');
});

test('API recognition creates pending items and requires weight before confirmation', async () => {
  await signIn('acct-p1');
  const meal = await openDraftMeal({ athleteId: 'p1', localDate: '2026-11-16', mealType: 'lunch' });
  const image = await attachMealImage(meal.mealId, meal.revision, { url: 'http://127.0.0.1:8000/uploads/test/original.jpg', objectKey: 'test/original.jpg' });
  await queueMealAnalysis(meal.mealId, image.revision);
  const finished = await finishMealAnalysis(meal.mealId, { succeeded: true, items: [{ foodId: 'f1', detectedLabel: '雞肉', grams: null }] });
  assert.equal(finished.items[0].grams, null);
  assert.equal(finished.nutrition.calories, 0);
  assert.equal(finished.image.url, 'http://127.0.0.1:8000/uploads/test/original.jpg');
  await assert.rejects(confirmMealItem(meal.mealId, finished.items[0].id, {}, finished.revision));
  await confirmMealItem(meal.mealId, finished.items[0].id, { weightG: 100, weightSource: 'manual' }, finished.revision);
  assert.ok((await readMeal(meal.mealId)).nutrition.calories > 0);
});

// 次佳與最佳共用一個項目，只將使用者選定菜色寫入營養快照。
test('alternative selection confirms one food item without double counting', async () => {
  const foods = [{ id: 'f1', name: '雞肉', sourceFoodCode: '1' }, { id: 'f2', name: '魚', sourceFoodCode: '2' }];
  const outcome = matchRecognition({ predictions: [{ name: '雞肉', dish_code: 1, bbox: [0.1, 0.2, 0.3, 0.4], alternative: { name: '魚', dish_code: 2 } }] }, foods);
  assert.equal(outcome.items.length, 1);
  assert.equal(outcome.items[0].alternative.foodId, 'f2');
  const modern = matchRecognition({ items: [{ detectedLabel: '雞肉', sourceFoodCode: '1', alternative: { detectedLabel: '未知', sourceFoodCode: '999' } }] }, foods);
  assert.equal(modern.items[0].alternative.foodId, null);
  await signIn('acct-p1');
  const meal = await openDraftMeal({ athleteId: 'p1', localDate: '2026-11-16', mealType: 'lunch' });
  const image = await attachMealImage(meal.mealId, meal.revision);
  await queueMealAnalysis(meal.mealId, image.revision);
  const result = await finishMealAnalysis(meal.mealId, outcome);
  assert.equal(result.items.length, 1);
  // 座標須保留至餐點讀取結果，左側才能繪製辨識框。
  assert.deepEqual(result.items[0].bbox, [0.1, 0.2, 0.3, 0.4]);
  const markup = mealImage({ url: '/original.jpg', annotatedUrl: '/result.jpg' }, { annotated: true, items: result.items });
  assert.match(markup, /recognition-box/);
  assert.match(markup, /left:10%;top:20%;width:30%;height:40%/);
  assert.match(markup, /src="\/original.jpg"/);
  assert.equal(result.items[0].alternative.foodId, 'f2');
  await confirmMealItem(meal.mealId, result.items[0].id, { foodId: 'f2', weightG: 100, weightSource: 'manual' }, result.revision);
  const confirmed = await readMeal(meal.mealId);
  assert.equal(confirmed.items.length, 1);
  assert.equal(confirmed.items[0].foodId, 'f2');
  assert.equal(confirmed.items[0].confirmationStatus, 'confirmed');
  const { seed } = await import('../js/api/seed.js');
  const expected = seed.foodNutrients.find(row => row.foodId === 'f2' && row.nutrientId === 'energy').amountPer100g;
  assert.equal(confirmed.nutrition.calories, Math.round(expected));
});
