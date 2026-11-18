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

console.log(process.exitCode ? 'FAILED' : 'all good');

