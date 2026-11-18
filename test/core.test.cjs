const C = require('../assets/core.js');
const assert = require('assert');

function ok(name, fn) {
  try { fn(); console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('core.js');

ok('Mifflin male', () => assert.equal(C.bmr({ sex: 'male', age: 28, height: 175, weight: 80 }), 1759));
ok('Mifflin female', () => assert.equal(C.bmr({ sex: 'female', age: 28, height: 165, weight: 60 }), 1330));

const p = C.planFrom({ sex: 'male', age: 28, height: 175, weight: 80, activity: 'hobby' });
ok('plan totals', () => {
  assert.equal(p.factor, 8);
  assert.equal(p.trainKcal, 640);
  assert.equal(p.tdee, 2399);
  assert.equal(p.kcal, 2399);
  assert.equal(p.grams.carb, 300);
  assert.equal(p.grams.protein, 180);
  assert.equal(p.grams.fat, 53);
});

ok('weekly target 90kg = 0.675', () => assert.equal(C.round(C.weeklyTargetKg(90, 3), 3), 0.675));
ok('weekly target 80kg = 0.6', () => assert.equal(C.weeklyTargetKg(80, 3), 0.6));

const s = C.createState({ sex: 'male', age: 28, height: 175, weight: 80, activity: 'hobby', goalWeight: 72 });
ok('state scaffold', () => {
  assert.equal(s.plan.base.carb, 300);
  assert.equal(s.weights.length, 1);
  assert.equal(s.pendings.length, 0);
  assert.equal(C.weekOf(s.startDate, s.startDate).week, 1);
  assert.equal(C.weekOf(s.startDate, s.startDate).dayInWeek, 1);
  assert.equal(C.weekOf(s.startDate, s.startDate).days, 0);
});

const day7 = C.addDaysKey(s.startDate, 6);
ok('check-in due on day 7', () => {
  assert.equal(C.dueWeek(s, C.addDaysKey(s.startDate, 5)), null);
  assert.equal(C.dueWeek(s, day7), 1);
  assert.equal(C.dueWeek(s, C.addDaysKey(s.startDate, 13)), 1, 'still week 1 unsettled');
});

ok('settle miss -> pending in 3 days', () => {
  const r = C.settleWeek(s, 1, 79.5);
  assert.equal(r.checkin.target, 0.6);
  assert.equal(r.checkin.actual, 0.5);
  assert.equal(r.checkin.hit, false);
  assert.ok(r.pending);
  assert.equal(r.pending.amount, 15);
  s.checkins.push(r.checkin);
  s.pendings.push(r.pending);
  assert.equal(C.dueWeek(s, C.addDaysKey(s.startDate, 13)), 2);
});

ok('apply cut reduces carbs only', () => {
  C.applyCarbCut(s, s.pendings[0]);
  const t = C.currentTargets(s.plan);
  assert.equal(t.carb, 285);
  assert.equal(t.protein, 180);
  assert.equal(t.fat, 53);
  assert.equal(t.cut, 15);
  assert.equal(t.kcal, 2399 - 15 * 4);
  assert.equal(s.checkins[0].action, 'reduce');
  assert.equal(s.checkins[0].carbAfter, 285);
  assert.equal(s.pendings.length, 0);
});

ok('hit keeps plan', () => {
  const r = C.settleWeek(s, 2, 78.9);
  assert.equal(r.checkin.hit, true, '78.9 vs target 0.6 → 0.6');
  assert.equal(r.pending, null);
});

ok('food macros', () => {
  const rice = C.FOODS.find(f => f.id === 'rice');
  const m = C.foodMacros(rice, 150);
  assert.equal(m.carb, 38.8);
  assert.equal(C.dayTotals({ foods: { [C.todayKey()]: [{ carb: 38.8, protein: 3.9, fat: 0.5 }] } }, C.todayKey()).carb, 38.8);
});

ok('upsert weight same day replaces', () => {
  C.upsertWeight(s, s.startDate, 80.2);
  C.upsertWeight(s, s.startDate, 79.8);
  assert.equal(s.weights.length, 1);
  assert.equal(s.weights[0].kg, 79.8);
});

ok('weightAt falls back to earlier', () => {
  assert.equal(C.weightAt(s, C.addDaysKey(s.startDate, 20)), 79.8);
});

ok('rebuild keeps adjustments, recomputes base', () => {
  const before = s.plan.adjustments.length;
  C.rebuildBase(s, 78.5, 0);
  assert.equal(s.plan.adjustments.length, before);
  assert.equal(s.plan.base.carb, Math.round(s.plan.kcal * 0.5 / 4));
});

ok('validate catches bad input', () => {
  assert.ok(C.validateProfile({ age: 10, height: 175, weight: 80 }).length >= 1);
  assert.equal(C.validateProfile({ age: 28, height: 175, weight: 80 }).length, 0);
  assert.ok(C.validateProfile({ age: 28, height: 175, weight: 80, goalWeight: 90 }).length >= 1);
});

ok('state dates are local-key stable', () => {
  const d = new Date(2026, 10, 18, 23, 59);
  assert.equal(C.toKey(d), '2026-11-18');
  assert.equal(C.addDaysKey('2026-11-30', 1), '2026-12-01');
});

ok('food library is unique and grouped', () => {
  assert.ok(C.FOODS.length >= 100);
  const ids = new Set(C.FOODS.map((f) => f.id));
  assert.equal(ids.size, C.FOODS.length);
  const keys = new Set(C.FOOD_GROUPS.map((g) => g.key));
  C.FOODS.forEach((f) => {
    assert.ok(keys.has(f.g), 'unknown group ' + f.g + ' on ' + f.id);
    assert.ok(f.portion > 0, 'portion missing on ' + f.id);
    assert.ok(f.carb >= 0 && f.protein >= 0 && f.fat >= 0, 'macro missing on ' + f.id);
  });
});

ok('workouts add, stats and remove', () => {
  const s = C.createState({ sex: 'male', age: 30, height: 178, weight: 85, activity: 'hobby' });
  assert.equal(C.workoutStats(s, C.addDaysKey(C.todayKey(), -6)).count, 0);
  C.addWorkout(s, { date: C.todayKey(), type: 'strength', minutes: 45 });
  C.addWorkout(s, { date: C.todayKey(), type: 'cardio', minutes: 30 });
  const st = C.workoutStats(s, C.addDaysKey(C.todayKey(), -6));
  assert.equal(st.count, 2);
  assert.equal(st.minutes, 75);
  assert.equal(st.byType.strength, 45);
  assert.equal(C.workoutLabel('strength'), '力量');
  const gone = C.removeWorkout(s, s.workouts[0].id);
  assert.ok(gone && gone.id);
  assert.equal(s.workouts.length, 1);
  assert.equal(C.workoutStats(s, C.addDaysKey(C.todayKey(), -6)).minutes, 30);
});

ok('weekly workouts bucket by 532 weeks', () => {
  const s = C.createState({ sex: 'male', age: 30, height: 178, weight: 85, activity: 'hobby' });
  s.startDate = C.addDaysKey(C.todayKey(), -20);
  C.addWorkout(s, { date: C.todayKey(), type: 'strength', minutes: 40 });
  C.addWorkout(s, { date: C.addDaysKey(C.todayKey(), -7), type: 'cardio', minutes: 25 });
  C.addWorkout(s, { date: C.addDaysKey(C.todayKey(), -8), type: 'cardio', minutes: 10 });
  const w = C.weeklyWorkouts(s, 6);
  assert.equal(w.length, 6);
  assert.equal(w[5].current, true);
  assert.equal(w[5].minutes, 40);
  assert.equal(w[4].minutes, 35);
  assert.equal(w[0].minutes, 0);
  assert.equal(w.reduce((a, x) => a + x.minutes, 0), 75);
});

ok('favorites toggle and order', () => {
  const s = C.createState({ sex: 'male', age: 30, height: 178, weight: 85, activity: 'hobby' });
  assert.equal(C.favoriteFoods(s).length, 0);
  assert.equal(C.toggleFavorite(s, 'rice'), true);
  assert.equal(C.toggleFavorite(s, 'egg'), true);
  assert.equal(C.isFavorite(s, 'egg'), true);
  assert.deepEqual(C.favoriteFoods(s).map((f) => f.id), ['rice', 'egg']);
  assert.equal(C.toggleFavorite(s, 'rice'), false);
  assert.deepEqual(C.favoriteFoods(s).map((f) => f.id), ['egg']);
  assert.equal(C.isFavorite(s, 'rice'), false);
});

ok('week review gathers weight, carb and work', () => {
  const s = C.createState({ sex: 'male', age: 30, height: 178, weight: 85, activity: 'hobby' });
  s.startDate = C.addDaysKey(C.todayKey(), -20);
  s.weights = [
    { date: s.startDate, kg: 85.0 },
    { date: C.addDaysKey(s.startDate, 7), kg: 84.6 }
  ];
  s.foods[C.addDaysKey(s.startDate, 1)] = [
    { id: 'rice', name: '米饭', grams: 300, carb: 77.7, protein: 7.8, fat: 0.9 }
  ];
  C.addWorkout(s, { date: C.addDaysKey(s.startDate, 8), type: 'strength', minutes: 45 });
  const r = C.weekReview(s, 2);
  assert.equal(r.week, 2);
  assert.equal(r.isCurrent, false);
  assert.equal(r.daysElapsed, 7);
  assert.equal(r.from, C.addDaysKey(s.startDate, 7));
  assert.equal(r.to, C.addDaysKey(s.startDate, 13));
  assert.equal(r.weight.end, 84.6);
  assert.equal(r.carb.days.length, 7);
  assert.equal(r.carb.logged, 0);
  assert.equal(r.workout.count, 1);
  assert.equal(r.workout.minutes, 45);
  assert.equal(r.workout.byType.strength, 45);
  const cur = C.weekReview(s);
  assert.equal(cur.isCurrent, true);
  assert.equal(cur.daysElapsed, 7);
  assert.equal(cur.status, 'open');
});

console.log(process.exitCode ? 'FAILED' : 'all good');

