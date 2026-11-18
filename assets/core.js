/*!
 * 532 碳降 · 核心逻辑
 * 无 DOM、无网络依赖：浏览器 <script> / Node require / 微信小程序 require 都能直接用。
 *
 * 方法（作者原版）：
 *   1. 热量 = 基础代谢 + 训练消耗（体重 × 5 / 8 / 10），首周按总消耗吃
 *   2. 营养素 5:3:2（碳水 50% / 蛋白 30% / 脂肪 20%）
 *   3. 目标：每月减 3% 体重 ≈ 每周 -0.75%
 *   4. 每周第 7 天称重：达标不动；未达标等 3 天，再降 15–30 g 碳水
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Carb532 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = 1;
  var KCAL = { carb: 4, protein: 4, fat: 9 };
  var FAT_KCAL_PER_KG = 7700;

  /* 训练消耗系数：体重(kg) × factor = 每日训练消耗(kcal) */
  var ACTIVITY = {
    novice: { key: 'novice', label: '新手 / 女生', factor: 5, hint: '刚起步，或每周 2–3 次' },
    hobby: { key: 'hobby', label: '普通爱好者', factor: 8, hint: '每周 3–5 次，训练有强度' },
    high: { key: 'high', label: '高强度', factor: 10, hint: '每周 5 次以上 / 体力劳动' }
  };
  var ACTIVITY_LIST = [ACTIVITY.novice, ACTIVITY.hobby, ACTIVITY.high];

  /* 常见食物，数值为每 100 g 的近似值（g） */
  var FOODS = [
    { g: 'staple', id: 'rice', name: '米饭（熟）', carb: 25.9, protein: 2.6, fat: 0.3, portion: 150 },
    { g: 'staple', id: 'noodle', name: '面条（熟）', carb: 24.9, protein: 4.5, fat: 0.5, portion: 150 },
    { g: 'staple', id: 'mantou', name: '馒头', carb: 47.0, protein: 7.0, fat: 1.1, portion: 100 },
    { g: 'staple', id: 'bread', name: '全麦面包', carb: 43.0, protein: 9.0, fat: 3.4, portion: 80 },
    { g: 'staple', id: 'oats', name: '燕麦片（干）', carb: 66.0, protein: 15.0, fat: 7.0, portion: 50 },
    { g: 'staple', id: 'sweetpot', name: '红薯', carb: 20.1, protein: 1.6, fat: 0.2, portion: 200 },
    { g: 'staple', id: 'potato', name: '土豆', carb: 17.2, protein: 2.0, fat: 0.2, portion: 200 },
    { g: 'staple', id: 'corn', name: '玉米（煮）', carb: 22.8, protein: 4.0, fat: 1.2, portion: 150 },
    { g: 'staple', id: 'pasta', name: '意面（干）', carb: 75.0, protein: 12.0, fat: 1.5, portion: 80 },
    { g: 'fruit', id: 'banana', name: '香蕉', carb: 22.0, protein: 1.4, fat: 0.2, portion: 120 },
    { g: 'fruit', id: 'apple', name: '苹果', carb: 13.5, protein: 0.3, fat: 0.2, portion: 200 },
    { g: 'protein', id: 'chicken', name: '鸡胸肉', carb: 0.0, protein: 31.0, fat: 3.6, portion: 150 },
    { g: 'protein', id: 'egg', name: '鸡蛋', carb: 0.7, protein: 13.0, fat: 9.0, portion: 50 },
    { g: 'protein', id: 'beef', name: '牛肉（瘦）', carb: 0.0, protein: 26.0, fat: 8.0, portion: 150 },
    { g: 'protein', id: 'salmon', name: '三文鱼', carb: 0.0, protein: 20.0, fat: 13.0, portion: 120 },
    { g: 'protein', id: 'tofu', name: '豆腐', carb: 2.0, protein: 8.0, fat: 4.0, portion: 200 },
    { g: 'dairy', id: 'milk', name: '牛奶', carb: 4.8, protein: 3.3, fat: 3.6, portion: 250 },
    { g: 'dairy', id: 'yogurt', name: '无糖酸奶', carb: 5.0, protein: 4.0, fat: 3.0, portion: 150 },
    { g: 'dairy', id: 'whey', name: '乳清蛋白粉', carb: 3.0, protein: 80.0, fat: 5.0, portion: 30 },
    { g: 'fat', id: 'almond', name: '杏仁', carb: 22.0, protein: 21.0, fat: 50.0, portion: 20 },
    { g: 'fat', id: 'oil', name: '食用油', carb: 0.0, protein: 0.0, fat: 100.0, portion: 10 }
  ];

  /* 食物分组，用于选择器里的分区展示 */
  var FOOD_GROUPS = [
    { key: 'staple', label: '主食' },
    { key: 'protein', label: '蛋白' },
    { key: 'fruit', label: '水果' },
    { key: 'dairy', label: '乳制品' },
    { key: 'fat', label: '坚果油脂' }
  ];

  /* ---------- 数字 ---------- */
  function round(v, d) {
    var p = Math.pow(10, d || 0);
    return Math.round((Number(v) || 0) * p) / p;
  }
  function toNum(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ---------- 日期（全部按本地时区） ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toKey(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
  function fromKey(key) {
    var p = String(key).split('-').map(Number);
    return new Date(p[0] || 1970, (p[1] || 1) - 1, p[2] || 1);
  }
  function dayStart(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  function addDays(date, n) {
    var x = new Date(date.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }
  function diffDays(a, b) {
    return Math.round((dayStart(b).getTime() - dayStart(a).getTime()) / 86400000);
  }
  function todayKey() { return toKey(new Date()); }
  function addDaysKey(key, n) { return toKey(addDays(fromKey(key), n)); }
  function diffDaysKeys(a, b) { return diffDays(fromKey(a), fromKey(b)); }

  /* ---------- 热量与营养素 ---------- */
  function bmr(profile) {
    var w = toNum(profile.weight);
    var h = toNum(profile.height);
    var a = toNum(profile.age);
    var base = 10 * w + 6.25 * h - 5 * a;
    return Math.round(profile.sex === 'female' ? base - 161 : base + 5);
  }

  function factorOf(key) {
    return (ACTIVITY[key] || ACTIVITY.hobby).factor;
  }

  /* 生成初始方案：input = {sex, age, height, weight, activity, overrideKcal} */
  function planFrom(input) {
    var b = bmr(input);
    var factor = factorOf(input.activity);
    var train = Math.round(toNum(input.weight) * factor);
    var tdee = Math.round(b + train);
    var overrideKcal = Math.round(toNum(input.overrideKcal));
    var kcal = overrideKcal > 0 ? overrideKcal : tdee;
    var pct = { carb: 50, protein: 30, fat: 20 };
    var grams = {
      carb: Math.round(kcal * pct.carb / 100 / KCAL.carb),
      protein: Math.round(kcal * pct.protein / 100 / KCAL.protein),
      fat: Math.round(kcal * pct.fat / 100 / KCAL.fat)
    };
    return {
      bmr: b, factor: factor, trainKcal: train, tdee: tdee,
      kcal: kcal, overrideKcal: overrideKcal, pct: pct, grams: grams
    };
  }

  /* 每周目标减重：每月 pct% → 每周 pct/4 % */
  function weeklyTargetKg(weight, monthPct) {
    return toNum(weight) * (toNum(monthPct, 3) / 100) / 4;
  }

  /* 当前执行方案：碳水随调整下降，蛋白 / 脂肪不变 */
  function currentTargets(plan) {
    var cut = 0;
    for (var i = 0; i < plan.adjustments.length; i++) cut += plan.adjustments[i].grams;
    var carb = Math.max(0, plan.base.carb - cut);
    var protein = plan.base.protein;
    var fat = plan.base.fat;
    return {
      carb: carb,
      protein: protein,
      fat: fat,
      /* 按"初始目标 − 已下调碳水的热量"计，与方案页的初始值保持一致 */
      kcal: Math.round(toNum(plan.kcal) - cut * KCAL.carb),
      cut: cut
    };
  }

  /* 体重变化折算热量缺口（只用于提示，不影响方案） */
  function carbCutToKcal(grams) { return Math.round(toNum(grams) * KCAL.carb); }
  function kcalToFatKg(kcalPerDay, days) {
    return round((toNum(kcalPerDay) * toNum(days, 7)) / FAT_KCAL_PER_KG, 3);
  }

  /* ---------- 状态 ---------- */
  function createState(input) {
    var today = todayKey();
    var plan = planFrom(input);
    return {
      version: VERSION,
      startDate: today,
      profile: {
        sex: input.sex === 'female' ? 'female' : 'male',
        age: toNum(input.age),
        height: toNum(input.height),
        weightStart: round(input.weight, 1),
        goalWeight: toNum(input.goalWeight) > 0 ? round(input.goalWeight, 1) : null,
        activity: ACTIVITY[input.activity] ? input.activity : 'hobby'
      },
      plan: {
        bmr: plan.bmr,
        factor: plan.factor,
        trainKcal: plan.trainKcal,
        tdee: plan.tdee,
        kcal: plan.kcal,
        overrideKcal: plan.overrideKcal,
        pct: plan.pct,
        base: plan.grams,
        monthPct: toNum(input.monthPct, 3),
        stepG: toNum(input.stepG, 15),
        adjustments: []
      },
      weights: [{ date: today, kg: round(input.weight, 1) }],
      checkins: [],
      pendings: [],
      foods: {},
      cheats: [],
      settings: { theme: 'auto' }
    };
  }

  /* 按新资料 / 体重重算基准（保留已下调的碳水） */
  function rebuildBase(state, weight, overrideKcal) {
    var p = planFrom({
      sex: state.profile.sex,
      age: state.profile.age,
      height: state.profile.height,
      weight: weight,
      activity: state.profile.activity,
      overrideKcal: overrideKcal == null ? state.plan.overrideKcal : overrideKcal
    });
    var plan = state.plan;
    plan.bmr = p.bmr;
    plan.factor = p.factor;
    plan.trainKcal = p.trainKcal;
    plan.tdee = p.tdee;
    plan.kcal = p.kcal;
    plan.base = p.grams;
    plan.overrideKcal = p.overrideKcal;
    return state;
  }

  /* ---------- 体重 ---------- */
  function sortedWeights(state) {
    return state.weights.slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }

  function upsertWeight(state, key, kg) {
    var w = sortedWeights(state);
    for (var i = 0; i < w.length; i++) {
      if (w[i].date === key) { w[i].kg = round(kg, 1); state.weights = w; return state; }
    }
    w.push({ date: key, kg: round(kg, 1) });
    state.weights = w.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return state;
  }

  function weightAt(state, key) {
    var w = sortedWeights(state);
    var found = null;
    for (var i = 0; i < w.length; i++) {
      if (w[i].date <= key) found = w[i].kg;
      else break;
    }
    return found;
  }

  function latestWeight(state) {
    var w = sortedWeights(state);
    return w.length ? w[w.length - 1] : null;
  }

  /* ---------- 周 / 结算 ---------- */
  function weekOf(startKey, key) {
    var d = Math.max(0, diffDaysKeys(startKey, key));
    return { week: Math.floor(d / 7) + 1, dayInWeek: (d % 7) + 1, days: d };
  }

  function checkinKey(startKey, week) {
    return addDaysKey(startKey, 7 * week - 1);
  }

  /* 最早一个已到期但未结算的周，没有则 null */
  function dueWeek(state, key) {
    var d = diffDaysKeys(state.startDate, key);
    if (d < 6) return null;
    var maxWeek = Math.floor(d / 7) + 1;
    for (var w = 1; w <= maxWeek; w++) {
      if (diffDaysKeys(checkinKey(state.startDate, w), key) < 0) continue;
      var done = false;
      for (var i = 0; i < state.checkins.length; i++) {
        if (state.checkins[i].week === w) { done = true; break; }
      }
      if (!done) return w;
    }
    return null;
  }

  /*
   * 结算一周：endWeight 为该周第 7 天（空腹）体重
   * 返回 { checkin, pending }，由调用方写回 state
   */
  function settleWeek(state, week, endWeight) {
    var plan = state.plan;
    var startDateKey = addDaysKey(state.startDate, 7 * (week - 1));
    var scheduled = checkinKey(state.startDate, week);
    var startWeight = weightAt(state, startDateKey);
    if (startWeight == null) startWeight = state.profile.weightStart;

    var target = round(weeklyTargetKg(startWeight, plan.monthPct), 2);
    var actual = round(startWeight - endWeight, 2);
    var hit = actual >= target - 0.02;
    var fast = actual > target * 1.6 && actual > 0.2;
    var carbNow = currentTargets(plan).carb;

    var checkin = {
      week: week,
      date: scheduled,
      settledOn: todayKey(),
      startWeight: round(startWeight, 1),
      endWeight: round(endWeight, 1),
      target: target,
      actual: actual,
      hit: hit,
      fast: fast,
      carbBefore: carbNow,
      carbAfter: carbNow,
      action: hit ? 'hold' : 'pending'
    };

    var pending = null;
    if (!hit) {
      pending = {
        week: week,
        amount: plan.stepG,
        carbBefore: carbNow,
        createdAt: todayKey(),
        dueDate: addDaysKey(todayKey(), 3)
      };
    }
    return { checkin: checkin, pending: pending };
  }

  /* 应用一次调碳：写入 plan.adjustments */
  function applyCarbCut(state, pending) {
    state.plan.adjustments.push({
      date: todayKey(),
      grams: pending.amount,
      week: pending.week
    });
    for (var i = 0; i < state.checkins.length; i++) {
      if (state.checkins[i].week === pending.week) {
        state.checkins[i].action = 'reduce';
        state.checkins[i].carbAfter = currentTargets(state.plan).carb;
      }
    }
    state.pendings = state.pendings.filter(function (p) { return p !== pending; });
    return state;
  }

  /* ---------- 饮食记录 ---------- */
  function dayTotals(state, key) {
    var list = state.foods[key] || [];
    var out = { carb: 0, protein: 0, fat: 0, kcal: 0 };
    for (var i = 0; i < list.length; i++) {
      out.carb += toNum(list[i].carb);
      out.protein += toNum(list[i].protein);
      out.fat += toNum(list[i].fat);
    }
    out.kcal = out.carb * KCAL.carb + out.protein * KCAL.protein + out.fat * KCAL.fat;
    return out;
  }

  function foodMacros(food, grams) {
    var k = toNum(grams) / 100;
    return {
      carb: round(food.carb * k, 1),
      protein: round(food.protein * k, 1),
      fat: round(food.fat * k, 1)
    };
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ---------- 校验 ---------- */
  function validateProfile(input) {
    var errs = [];
    var age = toNum(input.age), height = toNum(input.height), weight = toNum(input.weight);
    if (!(age >= 14 && age <= 80)) errs.push('年龄请填 14–80');
    if (!(height >= 120 && height <= 230)) errs.push('身高请填 120–230 cm');
    if (!(weight >= 35 && weight <= 300)) errs.push('体重请填 35–300 kg');
    if (input.goalWeight && toNum(input.goalWeight) > 0) {
      if (toNum(input.goalWeight) < 30 || toNum(input.goalWeight) >= weight) errs.push('目标体重应小于当前体重');
    }
    return errs;
  }

  /* 安全提示：只提示，不阻止 */
  function safetyNotes(profile, plan, targets) {
    var notes = [];
    var h = toNum(profile.height) / 100;
    var bmi = h > 0 ? toNum(profile.weightStart) / (h * h) : 0;
    if (bmi && bmi < 18.5) notes.push('BMI ' + round(bmi, 1) + '，偏低，减脂前建议先咨询医生。');
    if (targets && targets.carb < 50) notes.push('当前碳水低于 50 g，属于极低碳水区间，注意电解质与训练状态。');
    return notes;
  }

  return {
    VERSION: VERSION,
    KCAL: KCAL,
    FAT_KCAL_PER_KG: FAT_KCAL_PER_KG,
    ACTIVITY: ACTIVITY,
    ACTIVITY_LIST: ACTIVITY_LIST,
    FOODS: FOODS,
    FOOD_GROUPS: FOOD_GROUPS,

    round: round, toNum: toNum, clamp: clamp,
    toKey: toKey, fromKey: fromKey, todayKey: todayKey,
    addDays: addDays, addDaysKey: addDaysKey, diffDays: diffDays, diffDaysKeys: diffDaysKeys,

    bmr: bmr,
    factorOf: factorOf,
    planFrom: planFrom,
    weeklyTargetKg: weeklyTargetKg,
    currentTargets: currentTargets,
    carbCutToKcal: carbCutToKcal,
    kcalToFatKg: kcalToFatKg,

    createState: createState,
    rebuildBase: rebuildBase,

    sortedWeights: sortedWeights,
    upsertWeight: upsertWeight,
    weightAt: weightAt,
    latestWeight: latestWeight,

    weekOf: weekOf,
    checkinKey: checkinKey,
    dueWeek: dueWeek,
    settleWeek: settleWeek,
    applyCarbCut: applyCarbCut,

    dayTotals: dayTotals,
    foodMacros: foodMacros,
    newId: newId,
    validateProfile: validateProfile,
    safetyNotes: safetyNotes
  };
});
