/*!
 * 532 碳降 · 界面层
 * 纯原生 JS，无构建步骤；数据存在 localStorage。
 */
(function () {
  'use strict';

  var C = window.Carb532;
  var KEY = 'carb532.state.v1';
  var VIEWS = ['today', 'log', 'plan', 'me'];

  var state = null;
  var view = 'today';
  var reviewWeek = null;
  var sheet = null;
  var setup = { sex: 'male', activity: 'hobby' };
  var deferredPrompt = null;
  var toastTimer = null;
  var toastHandler = null;

  /* ---------------- 基础工具 ---------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function n0(v) { return Math.round(C.toNum(v)).toLocaleString('zh-CN'); }
  function n1(v) { return (Math.round(C.toNum(v) * 10) / 10).toFixed(1); }
  function n2(v) { return (Math.round(C.toNum(v) * 100) / 100).toFixed(2); }
  function signed(v) { var x = C.round(v, 1); return (x > 0 ? '+' : '') + x.toFixed(1); }

  var WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function prettyDate(key) {
    var d = C.fromKey(key);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WD[d.getDay()];
  }
  function md(key) {
    var d = C.fromKey(key);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }
  function mdWd(key) {
    var d = C.fromKey(key);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + WD[d.getDay()];
  }

  function toast(msg, actionLabel, onAction) {
    var el = $('#toast');
    toastHandler = actionLabel && onAction ? onAction : null;
    el.innerHTML = '<span class="toast-msg">' + esc(msg) + '</span>' +
      (actionLabel ? '<button type="button" class="toast-act" data-act="toast-act">' + esc(actionLabel) + '</button>' : '');
    el.classList.toggle('has-act', !!actionLabel);
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-on');
      toastHandler = null;
    }, actionLabel ? 5200 : 2400);
  }

  /* ---------------- 存储 ---------------- */

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || s.version !== C.VERSION || !s.plan || !s.profile || !s.startDate) return null;
      s.pendings = s.pendings || [];
      s.cheats = s.cheats || [];
      s.foods = s.foods || {};
      s.weights = s.weights || [];
      s.checkins = s.checkins || [];
      s.settings = s.settings || { theme: 'auto' };
      s.settings.textScale = s.settings.textScale || 1;
      s.workouts = s.workouts || [];
      s.plan.adjustments = s.plan.adjustments || [];
      return s;
    } catch (e) {
      return null;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      toast('保存失败：浏览器存储空间不足或被禁用');
    }
  }

  function applyTextScale() {
    var s = state && state.settings ? (state.settings.textScale || 1) : 1;
    document.documentElement.style.fontSize = (s * 100) + '%';
  }

  function applyTheme() {
    var t = state ? (state.settings.theme || 'auto') : 'auto';
    document.documentElement.setAttribute('data-theme', t);
    applyTextScale();
  }

  /* ---------------- 首次设置 ---------------- */

  function readSetup() {
    return {
      sex: setup.sex,
      age: C.toNum($('#age').value),
      height: C.toNum($('#height').value),
      weight: C.toNum($('#weight').value),
      goalWeight: C.toNum($('#goalWeight').value),
      activity: setup.activity
    };
  }

  function updatePreview() {
    var inp = readSetup();
    var ready = inp.age >= 14 && inp.height >= 120 && inp.weight >= 35;
    if (!ready) {
      $('#pvKcal').textContent = '—';
      $('#pvCarb').textContent = '—';
      $('#pvPro').textContent = '—';
      $('#pvFat').textContent = '—';
      $('#pvNote').textContent = '填完资料，这里会实时算出你的方案。';
      return;
    }
    var p = C.planFrom(inp);
    $('#pvKcal').textContent = n0(p.kcal);
    $('#pvCarb').textContent = p.grams.carb;
    $('#pvPro').textContent = p.grams.protein;
    $('#pvFat').textContent = p.grams.fat;
    var wk = C.weeklyTargetKg(inp.weight, 3);
    $('#pvNote').textContent = '首周按总消耗吃；每周目标 −' + n2(wk) + ' kg（每月 −3%）。';
  }

  function initSetup() {
    $$('.seg-btn[data-sex]').forEach(function (b) {
      b.addEventListener('click', function () {
        setup.sex = b.dataset.sex;
        $$('.seg-btn[data-sex]').forEach(function (x) {
          var on = x === b;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        updatePreview();
      });
    });

    $$('.choice[data-activity]').forEach(function (b) {
      b.addEventListener('click', function () {
        setup.activity = b.dataset.activity;
        $$('.choice[data-activity]').forEach(function (x) {
          var on = x === b;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        updatePreview();
      });
    });

    ['age', 'height', 'weight', 'goalWeight'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePreview);
    });

    $('#setupForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = readSetup();
      var errs = C.validateProfile(inp);
      var errBox = $('#setupError');
      if (errs.length) {
        errBox.textContent = errs.join('；');
        return;
      }
      errBox.textContent = '';
      state = C.createState(inp);
      view = 'today';
      saveState();
      render({ scroll: true });
      toast('方案已生成，先按总消耗吃一周');
    });

    updatePreview();
  }

  /* ---------------- 渲染 ---------------- */

  function render(opts) {
    opts = opts || {};
    applyTheme();
    if (!state) {
      $('#boot').hidden = false;
      $('#shell').hidden = true;
      return;
    }
    $('#boot').hidden = true;
    $('#shell').hidden = false;

    var wk = C.weekOf(state.startDate, C.todayKey());
    $('#wkTag').textContent = '第 ' + wk.week + ' 周 · 第 ' + wk.dayInWeek + ' 天';
    var viewTitle = { today: '今日', log: '记录', review: '回顾', plan: '方案', me: '我的' };
    var titleEl = $('#viewTitle');
    if (titleEl) titleEl.textContent = viewTitle[view] || '今日';

    $$('.tab').forEach(function (t) {
      var on = t.dataset.view === view;
      t.classList.toggle('is-on', on);
      if (on) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });

    var map = { today: viewToday, log: viewLog, review: viewReview, plan: viewPlan, me: viewMe };
    $('#main').innerHTML = (map[view] || viewToday)();
    syncChartWidth();

    if (opts.scroll) window.scrollTo(0, 0);
  }

  function macroRow(label, cls, got, target) {
    var pct = target > 0 ? Math.min(100, (got / target) * 100) : 0;
    var over = got > target + 0.5;
    return '<div class="macro ' + cls + '">' +
      '<div class="macro-top"><span>' + label + '</span>' +
      '<span class="macro-num' + (over ? ' is-over' : '') + '">' + Math.round(got) + '<i> / ' + Math.round(target) + ' g</i></span></div>' +
      '<div class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '</div>';
  }

  /* ---------------- 今日 ---------------- */

  /* 按吃过的次数排最近常吃，没记录过就用默认几样 */
  function recentFoods(limit) {
    var use = {};
    Object.keys(state.foods || {}).forEach(function (k) {
      (state.foods[k] || []).forEach(function (e) {
        var f = null;
        if (e.foodId) {
          f = C.FOODS.filter(function (x) { return x.id === e.foodId; })[0];
        }
        if (!f) f = C.FOODS.filter(function (x) { return x.name === e.name; })[0];
        if (!f) return;
        var u = use[f.id] || (use[f.id] = { n: 0, last: '' });
        u.n += 1;
        if (k > u.last) u.last = k;
      });
    });
    var list = C.FOODS.filter(function (f) { return use[f.id]; }).slice();
    list.sort(function (a, b) {
      var ua = use[a.id], ub = use[b.id];
      if (ub.n !== ua.n) return ub.n - ua.n;
      return ub.last > ua.last ? 1 : ub.last < ua.last ? -1 : 0;
    });
    ['rice', 'chicken', 'egg', 'milk', 'banana', 'oats'].forEach(function (id) {
      if (list.length >= limit) return;
      if (list.some(function (f) { return f.id === id; })) return;
      var f = C.FOODS.filter(function (x) { return x.id === id; })[0];
      if (f) list.push(f);
    });
    return list.slice(0, limit);
  }

  function viewToday() {
    var todayKey = C.todayKey();
    var wk = C.weekOf(state.startDate, todayKey);
    var t = C.currentTargets(state.plan);
    var tot = C.dayTotals(state, todayKey);
    var entries = state.foods[todayKey] || [];
    var last = C.latestWeight(state);
    var lastDays = last ? C.diffDaysKeys(last.date, todayKey) : null;
    var leftCarb = Math.max(0, Math.round(t.carb - tot.carb));
    var eatenPct = t.kcal > 0 ? Math.min(100, (tot.kcal / t.kcal) * 100) : 0;
    var overKcal = tot.kcal - t.kcal;

    var parts = [];

    parts.push(
      '<section class="hero">' +
        '<div class="hero-top">' +
          '<span class="chip">第 ' + wk.week + ' 周 · 第 ' + wk.dayInWeek + ' 天</span>' +
          '<span class="hero-date">' + prettyDate(todayKey) + '</span>' +
        '</div>' +
        '<p class="hero-label">今日摄入目标</p>' +
        '<div class="hero-num"><b>' + n0(t.kcal) + '</b><span>kcal</span></div>' +
        '<div class="hero-intake' + (overKcal > 0.5 ? ' is-over' : '') + '">' +
          '<div class="hero-track"><i style="width:' + eatenPct.toFixed(1) + '%"></i></div>' +
          '<div class="hero-intake-text">' +
            '<span>已摄入 <b>' + n0(tot.kcal) + '</b> kcal</span>' +
            '<span>' + (overKcal > 0.5 ? '超出 <b>' + n0(overKcal) + '</b> kcal' : '还可吃 <b>' + n0(-overKcal) + '</b> kcal') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="hero-macros">' +
          '<div><span>碳水' + (t.cut ? ' −' + t.cut + 'g' : '') + '</span><b>' + t.carb + '</b><i>g</i></div>' +
          '<div><span>蛋白</span><b>' + t.protein + '</b><i>g</i></div>' +
          '<div><span>脂肪</span><b>' + t.fat + '</b><i>g</i></div>' +
        '</div>' +
      '</section>'
    );

    parts.push(
      '<div class="quickrow">' +
        '<div class="quickrow-main">' +
          '<span class="k">晨重</span>' +
          '<span class="v">' + (last ? n1(last.kg) : '—') + '<small> kg</small></span>' +
          '<span class="muted small">' + (last ? (lastDays === 0 ? '今天已记录' : lastDays + ' 天前') : '每天空腹记录') + '</span>' +
        '</div>' +
        '<button type="button" class="btn tiny" data-act="open-weigh">记录</button>' +
      '</div>'
    );

    parts.push(cardSettle());
    state.pendings.forEach(function (p, i) { parts.push(cardPending(p, i)); });

    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>今日摄入</h2><span class="muted small">' + (entries.length ? entries.length + ' 项 · ' + n0(tot.kcal) + ' kcal' : '还没记录') + '</span></div>' +
        macroRow('碳水', 'm-carb', tot.carb, t.carb) +
        macroRow('蛋白', 'm-pro', tot.protein, t.protein) +
        macroRow('脂肪', 'm-fat', tot.fat, t.fat) +
        '<div class="carb-left"><span>今日碳水还可吃</span><b>' + leftCarb + ' g</b></div>' +
        '<div class="quickadd">' +
          '<div class="quickadd-head"><span class="overline">快速添加</span><button type="button" class="link" data-act="open-picker">全部食物 ' + C.FOODS.length + ' 种</button></div>' +
          '<div class="chips">' +
            recentFoods(6).map(function (f) {
              return '<button type="button" class="chip-food" data-act="open-food" data-food="' + f.id + '">' +
                '<b>' + esc(f.name) + '</b><span>' + f.portion + ' g</span></button>';
            }).join('') +
          '</div>' +
          '<button type="button" class="link quick-custom" data-act="open-custom">找不到？自定义一份</button>' +
        '</div>' +
      '</section>'
    );

    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>今日记录</h2><span class="muted small">' + (entries.length ? entries.length + ' 项' : '') + '</span></div>' +
        (entries.length
          ? '<ul class="loglist">' + entries.map(function (e) {
              var body = '<b>' + esc(e.name) + '</b>' +
                '<span>' + (e.grams ? n0(e.grams) + ' g · ' : '') + '碳 ' + n1(e.carb) + ' · 蛋 ' + n1(e.protein) + ' · 脂 ' + n1(e.fat) + '</span>';
              return '<li>' +
                (e.foodId
                  ? '<button type="button" class="log-main" data-act="edit-food" data-id="' + e.id + '" data-food="' + e.foodId + '" aria-label="修改 ' + esc(e.name) + ' 的克数">' + body + '</button>'
                  : '<div class="log-main">' + body + '</div>') +
                '<button type="button" class="icon-btn" data-act="del-food" data-id="' + e.id + '" aria-label="删除 ' + esc(e.name) + '">✕</button>' +
              '</li>';
            }).join('') + '</ul>'
          : '<p class="empty">用上面的快捷添加，或点「自定义一份」手动填。</p>') +
      '</section>'
    );

    parts.push(cardCheat());

    return parts.join('');
  }

  function cardSettle() {
    var due = C.dueWeek(state, C.todayKey());
    if (!due) return '';
    var startKey = C.addDaysKey(state.startDate, 7 * (due - 1));
    var startW = C.weightAt(state, startKey);
    if (startW == null) startW = state.profile.weightStart;
    var target = C.weeklyTargetKg(startW, state.plan.monthPct);
    var scheduled = C.checkinKey(state.startDate, due);
    var late = C.diffDaysKeys(scheduled, C.todayKey());
    var last = C.latestWeight(state);
    var cur = C.currentTargets(state.plan);

    return '<section class="card alert">' +
      '<div class="card-head"><span class="pill">第 ' + due + ' 周结算</span>' +
      '<span class="muted small">' + (late > 0 ? '已过 ' + late + ' 天' : '第 7 天，该称重了') + '</span></div>' +
      '<p class="alert-p">起点 <b>' + n1(startW) + ' kg</b>，目标减 <b>' + n2(target) + ' kg</b>（到 ' + n1(startW - target) + ' kg 左右）。</p>' +
      '<form class="inline-form" data-form="settle" data-week="' + due + '">' +
        '<label class="input-wrap"><input name="w" type="number" step="0.1" inputmode="decimal" value="' + (last ? n1(last.kg) : '') + '" placeholder="空腹体重" aria-label="第 ' + due + ' 周结算体重" required><span class="suffix">kg</span></label>' +
        '<button class="btn primary" type="submit">结算</button>' +
      '</form>' +
      '<p class="fine">对比第 7 天晨起空腹体重。达标就保持 ' + cur.carb + ' g 碳水不动。</p>' +
    '</section>';
  }

  function cardPending(p, i) {
    var can = C.diffDaysKeys(p.dueDate, C.todayKey()) >= 0;
    var wait = C.diffDaysKeys(C.todayKey(), p.dueDate);
    return '<section class="card alert warn">' +
      '<div class="card-head"><span class="pill">碳水待下调</span><span class="muted small">第 ' + p.week + ' 周没达标</span></div>' +
      '<p class="alert-p">按方案下调 <b>−' + p.amount + ' g</b> 碳水，约 <b>−' + (p.amount * 4) + ' kcal/天</b>。</p>' +
      '<p class="fine">' + (can
        ? '今天起可以执行，改完立即生效。'
        : '532 的规矩是等 3 天：' + md(p.dueDate) + ' 起再降，还有 ' + wait + ' 天。') + '</p>' +
      '<div class="btn-row">' +
        (can ? '<button type="button" class="btn primary" data-act="apply-cut" data-i="' + i + '">执行 −' + p.amount + ' g</button>' : '') +
        '<button type="button" class="btn ghost' + (can ? '' : ' block') + '" data-act="hold-cut" data-i="' + i + '">本周先不动</button>' +
      '</div>' +
    '</section>';
  }

  function cardCheat() {
    var cheats = state.cheats.slice().sort();
    var last = cheats.length ? cheats[cheats.length - 1] : null;
    var todayKey = C.todayKey();
    var status;
    var marked = false;

    if (!last) {
      status = '还没记过。建议每 7–15 天安排一次，放在晚上，吃完不补救。';
    } else {
      var d = C.diffDaysKeys(last, todayKey);
      marked = d === 0;
      if (d < 7) status = '距上次 <b>' + d + '</b> 天，再过 <b>' + (7 - d) + '</b> 天就可以安排。';
      else if (d <= 15) status = '距上次 <b>' + d + '</b> 天，正在窗口期，可以安排一顿。';
      else status = '距上次 <b>' + d + '</b> 天，早就过窗口了，推荐今晚安排。';
    }

    return '<section class="card">' +
      '<div class="card-head"><h2>放纵餐</h2><span class="muted small">7–15 天一次 · 放晚上</span></div>' +
      '<p class="cheat-status">' + status + '</p>' +
      '<div class="btn-row">' +
        '<button type="button" class="btn ghost" data-act="log-cheat"' + (marked ? ' disabled' : '') + '>' + (marked ? '今天已记录' : '记一次放纵餐') + '</button>' +
        (last ? '<button type="button" class="btn ghost" data-act="undo-cheat">撤销上次</button>' : '') +
      '</div>' +
      '<p class="fine">放纵餐不用补救：第二天照常吃，别加练、别断食。</p>' +
    '</section>';
  }

  /* ---------------- 记录 ---------------- */

  function viewLog() {
    var todayKey = C.todayKey();
    var last = C.latestWeight(state);
    var startW = state.profile.weightStart;
    var cur = last ? last.kg : startW;
    var wk = C.weekOf(state.startDate, todayKey);
    var weekStartKey = C.addDaysKey(state.startDate, 7 * (wk.week - 1));
    var weekStart = C.weightAt(state, weekStartKey);
    if (weekStart == null) weekStart = startW;
    var weekDelta = cur - weekStart;
    var hasThisWeek = state.weights.some(function (w) { return w.date >= weekStartKey; });
    var todayRec = null;
    state.weights.forEach(function (w) { if (w.date === todayKey) todayRec = w.kg; });
    var total = cur - startW;
    var goal = state.profile.goalWeight;
    var toGoal = goal ? cur - goal : null;
    var goalTxt;
    var goalCls = '';
    if (!goal) goalTxt = '未设置';
    else if (toGoal > 0.05) goalTxt = n1(toGoal) + '<small> kg</small>';
    else { goalTxt = '已达成'; goalCls = 'good'; }
    var parts = [];

    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>体重</h2><span class="muted small">' + (state.weights.length) + ' 次记录</span></div>' +
        '<form class="inline-form" data-form="weigh">' +
          '<label class="input-wrap"><input name="kg" type="number" step="0.1" inputmode="decimal" value="' + (todayRec != null ? n1(todayRec) : '') + '" placeholder="' + (last ? '今晨 ' + n1(last.kg) : '今晨体重') + '" aria-label="今天体重" required><span class="suffix">kg</span></label>' +
          '<button class="btn primary" type="submit">保存</button>' +
        '</form>' +
        '<div class="stat-row">' +
          '<div><span class="k">本周</span><b class="' + (hasThisWeek && weekDelta < 0 ? 'good' : '') + '">' + (hasThisWeek ? signed(weekDelta) + '<small> kg</small>' : '—') + '</b></div>' +
          '<div><span class="k">累计</span><b class="' + (total < 0 ? 'good' : '') + '">' + signed(total) + '<small> kg</small></b></div>' +
          '<div><span class="k">距目标</span><b class="' + goalCls + '">' + goalTxt + '</b></div>' +
        '</div>' +
      '</section>'
    );

    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>体重曲线</h2><span class="muted small">虚线 = 方案目标线</span></div>' +
        weightChart() +
      '</section>'
    );

    var wList = state.weights.slice().sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    }).slice(0, 12);

    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>每日记录</h2><button type="button" class="link" data-act="open-weigh">补记</button></div>' +
        (wList.length
          ? '<ul class="wlist">' + wList.map(function (w, i) {
              var prev = wList[i + 1];
              var d = prev ? w.kg - prev.kg : null;
              var cls = d == null || Math.abs(d) < 0.05 ? '' : d < 0 ? 'good' : 'bad';
              return '<li>' +
                '<button type="button" class="wrow" data-act="edit-weigh" data-date="' + w.date + '">' +
                  '<span class="wdate">' + mdWd(w.date) + '</span>' +
                  '<span class="wval">' + n1(w.kg) + '<small> kg</small></span>' +
                  '<span class="wdelta ' + cls + '">' + (d == null ? '—' : signed(d)) + '</span>' +
                '<span class="wchev" aria-hidden="true">›</span>' +
                '</button>' +
              '</li>';
            }).join('') + '</ul>'
          : '<p class="empty">还没有记录。在上面输入今晨体重，或点「补记」选过去某一天。</p>') +
        (wList.length ? '<p class="fine">每天一条，点某一行可以改那天的记录。</p>' : '') +
      '</section>'
    );

    var list = state.checkins.slice().sort(function (a, b) { return b.week - a.week; });

    var wkStat = C.workoutStats(state, weekStartKey);
    var recentWorkouts = (state.workouts || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 4);
    var wkBars = C.weeklyWorkouts(state, 6).filter(function (x) { return x.week >= 1; });
    var wkMax = 30;
    wkBars.forEach(function (x) { if (x.minutes > wkMax) wkMax = x.minutes; });
    var wkSum = wkBars.reduce(function (s, x) { return s + x.minutes; }, 0);
    var wkAria = '最近 6 周训练量（分钟）：' + wkBars.map(function (x) {
      return '第 ' + x.week + ' 周 ' + x.minutes;
    }).join('，') + '。';
    var wkChart = wkSum > 0
      ? '<div class="tchart" role="img" aria-label="' + wkAria + '">' +
          '<div class="tchart-head"><span class="overline">最近 6 周</span><span class="muted small">分钟</span></div>' +
          '<div class="tbars">' + wkBars.map(function (x) {
            var h = x.minutes ? Math.max(6, Math.round((x.minutes / wkMax) * 44)) : 3;
            return '<div class="tb' + (x.current ? ' is-now' : '') + (x.minutes ? '' : ' is-zero') + '">' +
              '<b>' + (x.minutes || '') + '</b>' +
              '<i style="height:' + h + 'px"></i>' +
              '<span>' + x.week + '</span>' +
            '</div>';
          }).join('') + '</div>' +
        '</div>'
      : '';
    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>训练</h2><button type="button" class="link" data-act="open-workout">记一次</button></div>' +
        '<div class="stat-row">' +
          '<div><span class="k">本周次数</span><b>' + wkStat.count + '<small> 次</small></b></div>' +
          '<div><span class="k">本周时长</span><b>' + wkStat.minutes + '<small> 分钟</small></b></div>' +
          '<div><span class="k">记录总数</span><b>' + (state.workouts || []).length + '<small> 次</small></b></div>' +
        '</div>' +
        wkChart +
        (recentWorkouts.length
          ? '<ul class="wlist">' + recentWorkouts.map(function (w) {
              return '<li>' +
                '<div class="wrow">' +
                  '<span class="wdate">' + md(w.date) + '</span>' +
                  '<span class="wtname"><i class="tag">' + C.workoutLabel(w.type) + '</i></span>' +
                  '<span class="wval">' + w.minutes + '<small> 分钟</small></span>' +
                  '<button type="button" class="icon-btn tiny-x" data-act="del-workout" data-id="' + w.id + '" aria-label="删除这次训练">✕</button>' +
                '</div>' +
              '</li>';
            }).join('') + '</ul>'
          : '<p class="empty">还没记过训练。力量、有氧、球类都可以记一笔。</p>') +
        '<p class="fine">训练只做记录，不会改动 532 的碳水目标；想调整热量请用「方案参数 → 手动总消耗」。</p>' +
      '</section>'
    );

    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>每周结算</h2><span class="muted small">' + (state.checkins.length ? '只看第 7 天' : '') + '</span></div>' +
        (list.length
          ? '<ul class="wk-list">' + list.map(function (c) {
              var tag = c.hit
                ? '<span class="tag good">达标</span>'
                : '<span class="tag bad">' + (c.action === 'reduce' ? '已调碳' : c.action === 'hold' ? '保持' : '待调碳') + '</span>';
              var note = c.hit
                ? '保持不动'
                : (c.action === 'reduce' ? '碳水 ' + c.carbBefore + ' → ' + c.carbAfter + ' g' : '未达标');
              return '<li>' +
                '<div class="wk-top"><b>第 ' + c.week + ' 周 ' + tag + '</b>' +
                '<span class="wk-delta ' + (c.hit ? 'good' : 'bad') + '">' + signed(-c.actual) + ' kg</span></div>' +
                '<div class="wk-sub">' + n1(c.startWeight) + ' → ' + n1(c.endWeight) + ' kg · 目标 −' + n2(c.target) + ' kg · ' + note + '</div>' +
              '</li>';
            }).join('') + '</ul>'
          : '<p class="empty">第 7 天称重并结算后，这里会出现每周记录。</p>') +
      '</section>'
    );

    return parts.join('');
  }

  /* 图表按容器实际像素宽绘制：viewBox 宽度 = 渲染宽度，SVG 不再被缩放，
     11px 的字就真的是 11px（之前 340 缩到约 322，字只有 10.4px） */
  var chartWidth = 0;

  function syncChartWidth() {
    var svg = document.querySelector('#main svg.chart');
    if (!svg) return;
    var w = Math.round(svg.getBoundingClientRect().width);
    if (w > 0 && Math.abs(w - chartWidth) > 1) {
      chartWidth = w;
      render();
    }
  }

  function weightChart() {
    var pts = C.sortedWeights(state);
    if (pts.length < 2) return '<p class="empty">记录 2 天以上就能看到曲线。</p>';

    var W = chartWidth || 318, H = 178, L = 30, R = 12, T = 18, B = 24;
    var t0 = Math.min(C.fromKey(state.startDate).getTime(), C.fromKey(pts[0].date).getTime());
    var t1 = Math.max(C.fromKey(C.todayKey()).getTime(), C.fromKey(pts[pts.length - 1].date).getTime());
    if (t1 <= t0) t1 = t0 + 86400000;
    var span = t1 - t0;
    var startW = state.profile.weightStart;
    var perWeek = C.weeklyTargetKg(startW, state.plan.monthPct);
    var targetEnd = startW - perWeek * ((t1 - t0) / (7 * 86400000)) * 1.2;

    var vals = pts.map(function (p) { return p.kg; }).concat([startW, targetEnd]);
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var padV = Math.max(0.45, (max - min) * 0.18);
    min -= padV;
    max += padV;

    var x = function (ts) { return L + ((ts - t0) / span) * (W - L - R); };
    var y = function (v) { return T + ((max - v) / (max - min)) * (H - T - B); };

    var firstP = pts[0], lastP = pts[pts.length - 1];
    var chartLabel = '体重曲线：' + pts.length + ' 次记录，' + md(firstP.date) + ' ' + n1(firstP.kg) +
      ' kg，' + md(lastP.date) + ' ' + n1(lastP.kg) + ' kg；虚线是每周 −' + n2(perWeek) + ' kg 的目标线。';
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(chartLabel) + '">';

    for (var g = 0; g < 3; g++) {
      var gv = min + (max - min) * (0.16 + g * 0.34);
      var gy = y(gv).toFixed(1);
      svg += '<line class="grid" x1="' + L + '" y1="' + gy + '" x2="' + (W - R) + '" y2="' + gy + '"/>';
      svg += '<text x="' + (L - 6) + '" y="' + (Number(gy) + 3) + '" text-anchor="end">' + n1(gv) + '</text>';
    }

    svg += '<line class="target" x1="' + x(t0).toFixed(1) + '" y1="' + y(startW).toFixed(1) + '" x2="' + x(t1).toFixed(1) + '" y2="' + y(targetEnd).toFixed(1) + '"/>';

    var line = '', area = '';
    pts.forEach(function (p, i) {
      var px = x(C.fromKey(p.date).getTime()).toFixed(1);
      var py = y(p.kg).toFixed(1);
      line += (i ? 'L' : 'M') + px + ' ' + py + ' ';
      if (i === 0) area = 'M' + px + ' ' + (H - B) + ' ';
      area += 'L' + px + ' ' + py + ' ';
    });
    area += 'L' + x(C.fromKey(pts[pts.length - 1].date).getTime()).toFixed(1) + ' ' + (H - B) + ' Z';

    svg += '<path class="area" d="' + area + '"/>';
    svg += '<path class="line" d="' + line + '"/>';

    pts.forEach(function (p, i) {
      if (i === pts.length - 1) return;
      svg += '<circle class="dot" cx="' + x(C.fromKey(p.date).getTime()).toFixed(1) + '" cy="' + y(p.kg).toFixed(1) + '" r="2.6"/>';
    });

    state.checkins.forEach(function (c) {
      var target = C.toKey(C.fromKey(c.date));
      var near = null;
      var best = 999;
      pts.forEach(function (p) {
        var d = Math.abs(C.diffDaysKeys(p.date, target));
        if (d < best) { best = d; near = p; }
      });
      if (near && best <= 3) {
        svg += '<circle class="chk" cx="' + x(C.fromKey(near.date).getTime()).toFixed(1) + '" cy="' + y(near.kg).toFixed(1) + '" r="3.4"/>';
      }
    });

    var lastP = pts[pts.length - 1];
    var lx = x(C.fromKey(lastP.date).getTime());
    var ly = y(lastP.kg);
    svg += '<circle class="dot last" cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="4.2"/>';

    svg += '<text x="' + L + '" y="' + (H - 6) + '">' + md(C.toKey(new Date(t0))) + '</text>';
    svg += '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + md(C.toKey(new Date(t1))) + '</text>';
    svg += '</svg>';
    svg += '<div class="chart-foot"><span>起点 ' + n1(startW) + ' kg</span><span>现在 ' + n1(pts[pts.length - 1].kg) + ' kg</span></div>';

    return svg;
  }

  /* ---------------- 回顾 ---------------- */

  function rvStatus(r) {
    if (r.status === 'hit') return { cls: 'good', text: '已达标' };
    if (r.status === 'reduced') return { cls: 'good', text: '已调碳' };
    if (r.status === 'pending') return { cls: 'warn', text: '待调碳' };
    if (r.status === 'waiting') return { cls: 'warn', text: '等 3 天' };
    if (r.status === 'missed') return { cls: 'bad', text: '未结算' };
    return { cls: '', text: '进行中' };
  }

  function viewReview() {
    var curWeek = C.weekOf(state.startDate, C.todayKey()).week;
    if (reviewWeek != null) reviewWeek = Math.min(curWeek, Math.max(1, reviewWeek));
    var r = C.weekReview(state, reviewWeek == null ? curWeek : reviewWeek);
    var st = rvStatus(r);
    var parts = [];

    parts.push(
      '<section class="card hero-soft">' +
        '<div class="card-head"><h2>第 ' + r.week + ' 周</h2>' +
          '<span class="pill ' + st.cls + '">' + st.text + '</span></div>' +
        '<div class="rv-nav">' +
          '<button type="button" class="icon-btn" data-act="rv-prev" aria-label="上一周"' + (r.week <= 1 ? ' disabled' : '') + '>‹</button>' +
          '<span class="rv-range">' + md(r.from) + ' – ' + md(r.to) + ' · ' +
            (r.isCurrent ? '第 ' + r.daysElapsed + ' / 7 天' : '已结束') + '</span>' +
          '<button type="button" class="icon-btn" data-act="rv-next" aria-label="下一周"' + (r.week >= curWeek ? ' disabled' : '') + '>›</button>' +
        '</div>' +
      '</section>'
    );

    var w = r.weight;
    var wtxt = (w.start == null || w.end == null || w.change === 0) ? '—' : signed(-w.change) + '<small> kg</small>';
    var wcls = (w.change != null && w.change > 0) ? 'good' : (w.change != null && w.change < 0 ? 'bad' : '');
    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>体重</h2><span class="muted small">' +
          (w.goal != null ? '本周目标 −' + n2(w.goal) + ' kg' : '') + '</span></div>' +
        '<div class="stat-row">' +
          '<div><span class="k">起点</span><b>' + (w.start != null ? n1(w.start) : '—') + '<small> kg</small></b></div>' +
          '<div><span class="k">现在</span><b>' + (w.end != null ? n1(w.end) : '—') + '<small> kg</small></b></div>' +
          '<div><span class="k">变化</span><b class="' + wcls + '">' + wtxt + '</b></div>' +
        '</div>' +
      '</section>'
    );

    var bars = r.carb.days.map(function (d) {
      var pct = d.target > 0 ? Math.min(100, (d.carb / d.target) * 100) : 0;
      var cls = d.over ? ' is-over' : (!d.logged ? ' is-empty' : '');
      return '<div class="rv-bar' + cls + '">' +
        '<span class="rv-val">' + (d.logged ? n0(d.carb) : '') + '</span>' +
        '<div class="rv-plot"><u class="rv-goal"></u>' +
          '<i style="height:' + Math.max(3, Math.round(pct * 0.46)) + 'px"></i></div>' +
        '<span class="rv-day">' + md(d.key).replace('/', '/') + '</span>' +
      '</div>';
    }).join('');
    var future = '';
    if (r.isCurrent) {
      for (var fi = r.carb.days.length; fi < 7; fi++) {
        future += '<div class="rv-bar is-future" aria-hidden="true">' +
          '<span class="rv-val"></span>' +
          '<div class="rv-plot"><u class="rv-goal"></u><i style="height:0"></i></div>' +
          '<span class="rv-day">' + md(C.addDaysKey(r.from, fi)).replace('/', '/') + '</span>' +
        '</div>';
      }
    }
    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>每日碳水</h2><span class="muted small">目标 ' + n0(r.carb.target) + ' g / 天 · 虚线</span></div>' +
        '<div class="rv-bars" role="img" aria-label="' + esc('本周每日碳水：' + r.carb.days.map(function (d) { return md(d.key) + ' ' + n0(d.carb) + ' 克'; }).join('，')) + '">' + bars + future + '</div>' +
        '<p class="rv-note">' + (r.carb.logged ? '记了 ' + r.carb.logged + ' 天的碳水，剩下的照 5:3:2 吃满就行。' : '这周还没记过吃的，点「今日 → 全部食物」开始。') + '</p>' +
      '</section>'
    );

    var types = Object.keys(r.workout.byType).map(function (k) {
      return '<span class="rv-chip">' + C.workoutLabel(k) + ' ' + r.workout.byType[k] + '′</span>';
    }).join('');
    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>训练</h2><span class="muted small">' + (r.workout.count ? r.workout.count + ' 次 · ' + r.workout.minutes + ' 分钟' : '还没练') + '</span></div>' +
        (types ? '<div class="rv-chips">' + types + '</div>' : '<p class="empty">这周还没记训练。力量、有氧、球类都可以补记。</p>') +
      '</section>'
    );

    var hint;
    if (r.status === 'hit') hint = '达标就保持，蛋白、脂肪、碳水都别动，下周继续。';
    else if (r.status === 'reduced') hint = '已经降过碳水，接下来照新目标吃，等第 7 天再看。';
    else if (r.status === 'pending' || r.status === 'waiting') hint = '还差一点。按 532 的规矩等 3 天，再降 15 g 碳水。';
    else if (r.status === 'missed') hint = '这周没结算。可以回记录页补上第 7 天的体重。';
    else if (r.daysElapsed >= 7) hint = '今天是第 7 天，空腹称重后去结算这一周。';
    else hint = '第 7 天空腹称重后结算；现在照目标吃就好。';
    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>这一周</h2></div>' +
        '<p class="rv-hint">' + hint + '</p>' +
      '</section>'
    );

    parts.push(trendCard());

    return parts.join('');
  }

  /* 近 8 周趋势：周末体重折线 + 每周平均碳水 */
  function trendCard() {
    var m = C.monthlyReview(state, 8);
    var list = m.weeks;
    if (list.length < 2) {
      return '<section class="card">' +
        '<div class="card-head"><h2>趋势</h2><span class="muted small">体重 · 平均碳水</span></div>' +
        '<p class="empty">过两周这里会出现体重折线和每周平均碳水，现在先按目标吃。</p>' +
      '</section>';
    }
    var weights = list.filter(function (w) { return w.weightEnd != null; });
    var head = '<div class="card-head"><h2>近 ' + list.length + ' 周</h2>' +
      '<span class="muted small">体重 · 平均碳水</span></div>';

    var chart;
    if (weights.length < 2) {
      chart = '<p class="empty">再记 ' + (2 - weights.length) + ' 周体重，这里就会出现趋势线。</p>';
    } else {
      var W = 320, H = 84, P = 14;
      var ys = weights.map(function (w) { return w.weightEnd; });
      var lo = Math.min.apply(null, ys) - 0.4, hi = Math.max.apply(null, ys) + 0.4;
      if (hi - lo < 0.8) { hi = lo + 0.8; }
      function px(i) { return P + (list.length === 1 ? 0 : i / (list.length - 1)) * (W - 2 * P); }
      function py(v) { return H - P - ((v - lo) / (hi - lo)) * (H - 2 * P); }
      var pts = [];
      list.forEach(function (w, i) { if (w.weightEnd != null) pts.push([px(i), py(w.weightEnd)]); });
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      var dots = pts.map(function (p) { return '<circle class="dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.8"/>'; }).join('');
      var last = pts[pts.length - 1];
      chart = '<svg class="chart trend" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
        esc('近 ' + list.length + ' 周周末体重：' + weights.map(function (w) { return '第' + w.week + '周 ' + n1(w.weightEnd) + ' 公斤'; }).join('，')) + '">' +
        '<path class="line" d="' + d + '"/>' + dots +
        '<text class="cap" x="' + last[0].toFixed(1) + '" y="' + (last[1] - 8).toFixed(1) + '" text-anchor="end">' + n1(weights[weights.length - 1].weightEnd) + '</text>' +
      '</svg>';
    }

    var weeks = list.map(function (w) {
      var pct = w.carbAvg != null ? Math.min(100, (w.carbAvg / w.carbTarget) * 100) : 0;
      var cls = w.carbAvg == null ? ' is-empty' : (w.carbAvg > w.carbTarget + 0.5 ? ' is-over' : '');
      return '<div class="rv-bar' + cls + '">' +
        '<span class="rv-val">' + (w.carbAvg != null ? n0(w.carbAvg) : '') + '</span>' +
        '<div class="rv-plot"><u class="rv-goal"></u>' +
          '<i style="height:' + Math.max(3, Math.round(pct * 0.46)) + 'px"></i></div>' +
        '<span class="rv-day">' + w.week + '</span>' +
      '</div>';
    }).join('');

    return '<section class="card">' + head +
      chart +
      '<div class="rv-bars small" role="img" aria-label="' +
        esc('近 ' + list.length + ' 周平均每日碳水：' + list.map(function (w) { return '第' + w.week + '周 ' + (w.carbAvg == null ? '无记录' : n0(w.carbAvg) + ' 克'); }).join('，')) + '">' + weeks + '</div>' +
      '<p class="rv-note">柱子是每周的平均每日碳水，只算有记录的天；虚线是当前目标。' +
        (list.some(function (w) { return w.minutes > 0; })
          ? ' 这 ' + list.length + ' 周共训练 ' + list.reduce(function (s, w) { return s + w.minutes; }, 0) + ' 分钟。'
          : '') + '</p>' +
    '</section>';
  }

  /* ---------------- 方案 ---------------- */

  function viewPlan() {
    var plan = state.plan;
    var profile = state.profile;
    var t = C.currentTargets(plan);
    var baseKcal = plan.kcal;
    var dKcal = (t.carb - plan.base.carb) * 4;
    var fatWeek = C.kcalToFatKg(-dKcal, 7);
    var wNow = C.latestWeight(state);
    var weightNow = wNow ? wNow.kg : profile.weightStart;
    var weekTarget = C.weeklyTargetKg(weightNow, plan.monthPct);
    var monthTarget = weightNow * plan.monthPct / 100;
    var act = C.ACTIVITY[profile.activity] || C.ACTIVITY.hobby;
    var parts = [];

    parts.push(
      '<section class="card heat">' +
        '<div class="card-head"><h2>每日热量</h2><span class="tag">首周按此吃</span></div>' +
        '<div class="heat-rows">' +
          '<div class="heat-row"><span>基础代谢 <small>Mifflin</small></span><b>' + n0(plan.bmr) + '</b></div>' +
          '<div class="heat-row"><span>训练消耗 <small>' + n1(profile.weightStart) + ' kg × ' + plan.factor + '</small></span><b>' + n0(plan.trainKcal) + '</b></div>' +
          '<div class="heat-row total"><span>总消耗 = 初始目标</span><b>' + n0(plan.tdee) + '</b></div>' +
        '</div>' +
        (plan.overrideKcal ? '<p class="fine">已手动指定总消耗 ' + n0(plan.kcal) + ' kcal（公式值 ' + n0(plan.tdee) + '）。</p>' : '') +
      '</section>'
    );

    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>5 : 3 : 2</h2><span class="muted small">初始 ' + n0(baseKcal) + ' kcal</span></div>' +
        '<div class="stack" role="img" aria-label="碳水 50%，蛋白 30%，脂肪 20%">' +
          '<i class="s-carb" style="width:50%"></i><i class="s-pro" style="width:30%"></i><i class="s-fat" style="width:20%"></i>' +
        '</div>' +
        '<ul class="legend">' +
          '<li><span class="lk c"><i></i>碳水 50% · ' + n0(plan.base.carb * 4) + ' kcal</span><b>' + plan.base.carb + ' g</b></li>' +
          '<li><span class="lk p"><i></i>蛋白 30% · ' + n0(plan.base.protein * 4) + ' kcal</span><b>' + plan.base.protein + ' g</b></li>' +
          '<li><span class="lk f"><i></i>脂肪 20% · ' + n0(plan.base.fat * 9) + ' kcal</span><b>' + plan.base.fat + ' g</b></li>' +
        '</ul>' +
        '<p class="fine">用计算热量的软件搭天然食物就行。之后只降碳水，蛋白和脂肪的克数不动。</p>' +
      '</section>'
    );

    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>当前执行</h2><span class="muted small">' + (t.cut ? '已下调 ' + t.cut + ' g' : '还没调过') + '</span></div>' +
        '<div class="kv"><span>初始碳水</span><b>' + plan.base.carb + ' g</b></div>' +
        '<div class="kv"><span>累计下调</span><b class="cut">' + (t.cut ? '−' + t.cut + ' g' : '0 g') + '</b></div>' +
        '<div class="kv strong"><span>当前碳水</span><b>' + t.carb + ' g</b></div>' +
        '<div class="kv"><span>蛋白 / 脂肪</span><b>' + t.protein + ' / ' + t.fat + ' g</b></div>' +
        '<div class="kv"><span>当前热量</span><b>' + n0(t.kcal) + ' kcal</b></div>' +
        (t.cut
          ? '<p class="fine">比初始少 ' + n0(-dKcal) + ' kcal/天，理论周减脂约 ' + n2(fatWeek) + ' kg。</p>'
          : '<p class="fine">第 7 天称重后，再决定要不要降碳水。</p>') +
      '</section>'
    );

    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>碳水阶梯</h2><span class="muted small">每周只动这一项</span></div>' +
        carbSteps() +
        '<p class="fine">' + (state.plan.adjustments.length
          ? '虚线是当前周。每次下调后，后面的台阶就是新的碳水目标。'
          : '还没调过碳水。第 7 天结算后，没达标才会有下一级台阶。') + '</p>' +
      '</section>'
    );

    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>532 规则</h2><span class="muted small">' + n2(weekTarget) + ' kg / 周</span></div>' +
        '<p class="rule-brief">首周按总消耗吃，之后每周只看第 7 天；达标不动，没达标等 3 天再降 ' + plan.stepG + ' g 碳水。</p>' +
        '<button type="button" class="link" data-act="open-rules">查看全部 5 条规则</button>' +
      '</section>'
    );

    return parts.join('');
  }

  /* 规则清单：方案页的折叠入口与 sheet 共用同一份内容 */
  function rulesHtml() {
    var plan = state.plan;
    var profile = state.profile;
    var act = C.ACTIVITY[profile.activity] || C.ACTIVITY.hobby;
    var wNow = C.latestWeight(state);
    var weightNow = wNow ? wNow.kg : profile.weightStart;
    var weekTarget = C.weeklyTargetKg(weightNow, plan.monthPct);
    var monthTarget = weightNow * plan.monthPct / 100;

    return '<ol class="rules">' +
      '<li><b>首周按总消耗吃。</b>基础代谢 + 体重 × ' + plan.factor + '（' + esc(act.label) + '），不刻意制造缺口。</li>' +
      '<li><b>5 : 3 : 2。</b>碳水 50%、蛋白 30%、脂肪 20%，按克数吃到就好。</li>' +
      '<li><b>每月减 ' + plan.monthPct + '% 体重。</b>当前约 ' + n2(weekTarget) + ' kg/周、' + n1(monthTarget) + ' kg/月，每天记录空腹体重。</li>' +
      '<li><b>只看第 7 天。</b>达标就不动；没达标等 3 天，再降 ' + plan.stepG + ' g 碳水。</li>' +
      '<li><b>放纵日 7–15 天一次。</b>放在晚上吃，不用补救。</li>' +
    '</ol>';
  }

  /* 方案参数：低频调节项，放在「我的」里 */
  function advancedSettingsHtml() {
    var plan = state.plan;
    return '<section class="card">' +
        '<div class="card-head"><h2>方案参数</h2><span class="muted small">改完立即生效</span></div>' +
        '<div class="setting">' +
          '<div class="label">每月减重<small>默认 3%</small></div>' +
          '<select class="select" data-set="monthPct" aria-label="每月减重比例">' +
            [2, 2.5, 3, 3.5, 4].map(function (v) {
              return '<option value="' + v + '"' + (plan.monthPct === v ? ' selected' : '') + '>-' + v + '%</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="setting">' +
          '<div class="label">每次调碳<small>15–30 g</small></div>' +
          '<select class="select" data-set="stepG" aria-label="每次调碳克数">' +
            [15, 20, 25, 30].map(function (v) {
              return '<option value="' + v + '"' + (plan.stepG === v ? ' selected' : '') + '>−' + v + ' g</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="setting stacked">' +
          '<div class="label">手动总消耗<small>有手表 / 体测数据时填，留空用公式</small></div>' +
          '<form class="mini-form" data-form="override">' +
            '<label class="input-wrap"><input name="kcal" type="number" inputmode="numeric" min="800" max="6000" step="10" value="' + (plan.overrideKcal || '') + '" placeholder="' + plan.tdee + '" aria-label="手动总消耗"><span class="suffix">kcal</span></label>' +
            '<button class="btn tiny" type="submit">应用</button>' +
          '</form>' +
        '</div>' +
        '<div class="btn-row"><button type="button" class="btn ghost" data-act="recalc">按当前体重重算基准</button></div>' +
      '</section>';
  }

  function carbSteps() {
    var base = state.plan.base.carb;
    var nowWeek = C.weekOf(state.startDate, C.todayKey()).week;
    var totalWeeks = Math.max(6, nowWeek + 1);
    var rows = [];

    for (var w = 1; w <= totalWeeks; w++) {
      var cut = 0;
      state.plan.adjustments.forEach(function (a) {
        var aw = C.weekOf(state.startDate, a.date).week;
        if (aw <= w) cut += a.grams;
      });
      rows.push(Math.max(0, base - cut));
    }

    var W = chartWidth || 318, H = 150, L = 30, R = 12, T = 14, B = 22;
    var minV = Math.min.apply(null, rows);
    var maxV = Math.max.apply(null, rows);
    var pad = Math.max(10, (maxV - minV) * 0.25);
    var lo = Math.max(0, minV - pad);
    var hi = maxV + pad * 0.6;
    var dx = (W - L - R) / totalWeeks;
    var y = function (v) { return T + ((hi - v) / (hi - lo)) * (H - T - B); };

    var totalCut = state.plan.adjustments.reduce(function (sum, a) { return sum + a.grams; }, 0);
    var stepLabel = '碳水阶梯：初始 ' + base + ' g，下调 ' + state.plan.adjustments.length + ' 次共 ' + totalCut +
      ' g，当前 ' + rows[rows.length - 1] + ' g，共 ' + totalWeeks + ' 周。';
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(stepLabel) + '">';

    svg += '<line class="grid" x1="' + L + '" y1="' + y(base).toFixed(1) + '" x2="' + (W - R) + '" y2="' + y(base).toFixed(1) + '"/>';
    svg += '<text x="' + (L - 6) + '" y="' + (y(base) + 3).toFixed(1) + '" text-anchor="end">' + base + '</text>';

    var line = 'M' + L + ' ' + y(rows[0]).toFixed(1);
    for (var i = 1; i < totalWeeks; i++) {
      var px = (L + dx * i).toFixed(1);
      line += ' H' + px + ' V' + y(rows[i]).toFixed(1);
    }
    line += ' H' + (W - R);

    var areaPath = line + ' V' + (H - B) + ' H' + L + ' Z';
    svg += '<path class="step-area" d="' + areaPath + '"/>';
    svg += '<path class="step-line" d="' + line + '"/>';

    var nowX = (L + dx * (nowWeek - 1) + dx / 2).toFixed(1);
    svg += '<line class="now-line" x1="' + nowX + '" y1="' + T + '" x2="' + nowX + '" y2="' + (H - B) + '"/>';

    var showAll = totalWeeks <= 8;
    for (var k = 0; k < totalWeeks; k++) {
      if (showAll || k === 0 || k === nowWeek - 1 || (k + 1) % 2 === 0) {
        svg += '<text x="' + (L + dx * k + dx / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + (k + 1) + '</text>';
      }
    }

    svg += '<text class="cap" x="' + (W - R) + '" y="' + (y(rows[totalWeeks - 1]) - 6).toFixed(1) + '" text-anchor="end">' + rows[totalWeeks - 1] + ' g</text>';
    svg += '</svg>';

    return svg;
  }

  /* ---------------- 我的 ---------------- */

  function viewMe() {
    var p = state.profile;
    var act = C.ACTIVITY[p.activity] || C.ACTIVITY.hobby;
    var theme = state.settings.theme || 'auto';
    var last = C.latestWeight(state);

    return '<section class="card">' +
        '<div class="card-head"><h2>我的资料</h2><button type="button" class="link" data-act="open-profile">修改</button></div>' +
        '<div class="profile-grid">' +
          '<div><span class="k">性别</span><b>' + (p.sex === 'female' ? '女' : '男') + '</b></div>' +
          '<div><span class="k">年龄</span><b>' + p.age + ' 岁</b></div>' +
          '<div><span class="k">身高</span><b>' + p.height + ' cm</b></div>' +
          '<div><span class="k">训练强度</span><b>' + esc(act.label) + '</b></div>' +
          '<div><span class="k">起始体重</span><b>' + n1(p.weightStart) + ' kg</b></div>' +
          '<div><span class="k">现在</span><b>' + (last ? n1(last.kg) : '—') + ' kg</b></div>' +
          '<div><span class="k">目标体重</span><b>' + (p.goalWeight ? n1(p.goalWeight) + ' kg' : '未设置') + '</b></div>' +
          '<div><span class="k">已坚持</span><b>' + (C.weekOf(state.startDate, C.todayKey()).days + 1) + ' 天</b></div>' +
        '</div>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h2>显示</h2><span class="muted small">外观跟随系统</span></div>' +
        '<div class="setting stacked">' +
          '<div class="label">文字大小<small>放大后卡片跟着长高，不会裁字</small></div>' +
          '<div class="seg" role="group" aria-label="文字大小">' +
            [[1, '标准'], [1.15, '大'], [1.3, '特大']].map(function (pair) {
              var on = Math.abs((state.settings.textScale || 1) - pair[0]) < 0.01;
              return '<button type="button" class="seg-btn' + (on ? ' is-on' : '') + '" data-text-scale="' + pair[0] + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + pair[1] + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="setting">' +
          '<div class="label">外观<small>一般不用改，跟随系统最省心</small></div>' +
          '<select class="select" data-set="theme" aria-label="外观">' +
            '<option value="auto"' + (theme === 'auto' ? ' selected' : '') + '>跟随系统</option>' +
            '<option value="light"' + (theme === 'light' ? ' selected' : '') + '>浅色</option>' +
            '<option value="dark"' + (theme === 'dark' ? ' selected' : '') + '>深色</option>' +
          '</select>' +
        '</div>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h2>数据</h2><span class="muted small">只在本机</span></div>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn ghost" data-act="export">导出备份</button>' +
          '<button type="button" class="btn ghost" data-act="import">导入备份</button>' +
        '</div>' +
        '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
        '<button type="button" class="btn danger block" data-act="reset">清空并重新开始</button>' +
        '<p class="fine">数据存在浏览器本地。换手机或清缓存前先导出 JSON，再在新设备导入。</p>' +
      '</section>' +

      advancedSettingsHtml() +

      '<section class="card">' +
        '<div class="card-head"><h2>装到主屏</h2></div>' +
        '<p class="about">iPhone 用 Safari 打开 → 分享 → 添加到主屏幕；Android 用 Chrome → 菜单 → 安装应用。装好后像原生 App 一样全屏，离线也能记。</p>' +
        '<button type="button" class="btn ghost block" data-act="install" id="installBtn"' + (deferredPrompt ? '' : ' hidden') + '>一键安装</button>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h2>关于</h2><span class="muted small">v1.0</span></div>' +
        '<p class="about">按「532 碳水渐降减脂法」实现：<b>先算热量 → 定目标周期 → 只调碳水</b>。每周第 7 天称重，达标不动，未达标 3 天后降 15–30 g 碳水。</p>' +
        '<p class="fine">本工具只做记录和计算，不构成医疗或营养建议。有基础疾病、孕期或未成年，请先咨询医生。食物营养值为常见近似值。</p>' +
      '</section>';
  }

  /* ---------------- 底部面板 ---------------- */

  function openSheet(cfg) {
    if (!sheet) rememberFocus();
    sheet = cfg;
    var panel = $('#sheetLayer').querySelector('.sheet');
    if (panel) { panel.style.animation = ''; panel.style.transform = ''; }
    $('#sheetBody').innerHTML = sheetHtml();
    $('#sheetLayer').hidden = false;
    document.body.classList.add('no-scroll');
    bindSheet();
    if (sheet.type === 'picker') return;
    setTimeout(function () {
      var input = $('#sheetBody input');
      if (input) { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } }
    }, 180);
  }

  function closeSheet() {
    sheet = null;
    $('#sheetLayer').hidden = true;
    document.body.classList.remove('no-scroll');
    $('#sheetBody').innerHTML = '';
    restoreFocus();
  }

  function bindSheetDrag() {
    var layer = $('#sheetLayer');
    var panel = layer.querySelector('.sheet');
    var grip = layer.querySelector('.sheet-grip');
    if (!panel || !grip) return;
    var startY = 0, dy = 0, pid = null;
    grip.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pid = e.pointerId;
      startY = e.clientY;
      dy = 0;
      panel.style.animation = 'none';
      panel.style.transition = 'none';
      try { grip.setPointerCapture(pid); } catch (err) {}
    });
    grip.addEventListener('pointermove', function (e) {
      if (pid === null || e.pointerId !== pid) return;
      dy = Math.max(0, e.clientY - startY);
      panel.style.transform = 'translateY(' + dy + 'px)';
    });
    function end(e) {
      if (pid === null || (e && e.pointerId !== pid)) return;
      pid = null;
      panel.style.transition = '';
      panel.style.transform = '';
      if (dy > 96) closeSheet();
    }
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }

  function sheetHead(title, sub, back) {
    return '<div class="sheet-head">' +
      (back ? '<button type="button" class="icon-btn" data-act="back-picker" aria-label="返回食材列表">‹</button>' : '') +
      '<div class="sheet-head-main"><h3 id="sheetTitle">' + title + '</h3>' +
      (sub ? '<p class="sheet-sub">' + sub + '</p>' : '') + '</div>' +
      '<button type="button" class="icon-btn" data-act="close-sheet" aria-label="关闭">✕</button></div>';
  }

  function sheetHtml() {
    if (!sheet) return '';

    if (sheet.type === 'food') {
      var f = sheet.food;
      var basis = f.basis ? '（' + f.basis + '重）' : '';
      var grams0 = sheet.grams || f.portion;
      var portionBtns = (f.portions || []).map(function (p) {
        return '<button type="button" class="gbtn pbtn" data-g="' + p.g + '">' + esc(p.label) + '<i>' + p.g + ' g</i></button>';
      }).join('');
      var gramBtns = [50, 100, 150, 200, 250].map(function (g) {
        return '<button type="button" class="gbtn' + (g === f.portion ? ' is-on' : '') + '" data-g="' + g + '">' + g + ' g</button>';
      }).join('');
      var srcTxt = f.src === 'label' ? '数据：产品营养成分表' : '数据：' + C.DATA_SOURCE;
      return '<form data-form="add-food" data-food="' + f.id + '"' + (sheet.editId ? ' data-edit="' + sheet.editId + '"' : '') + '>' +
        sheetHead(esc(f.name), '每 100 g' + basis + '：碳水 ' + f.carb + ' g · 蛋白 ' + f.protein + ' g · 脂肪 ' + f.fat + ' g', sheet.back) +
        '<div class="sheet-body">' +
          (portionBtns
            ? '<div class="portion-row">' + portionBtns + '</div>'
            : '') +
          '<div class="grams-row">' + (portionBtns ? '' : gramBtns) +
            '<label class="input-wrap"><input id="foodGrams" name="grams" type="number" inputmode="decimal" min="1" max="2000" step="1" value="' + grams0 + '" aria-label="克数"><span class="suffix">g</span></label>' +
          '</div>' +
          '<div class="sheet-sum" id="foodSum"></div>' +
          '<p class="src-note">' + srcTxt + '</p>' +
        '</div>' +
        '<button class="btn primary block" type="submit">' + (sheet.editId ? '保存修改' : '加入今日') + '</button>' +
      '</form>';
    }

    if (sheet.type === 'picker') {
      return '<div class="sheet-head">' +
          '<div class="sheet-head-main"><h3 id="sheetTitle">选择食物</h3>' +
          '<p class="sheet-sub">' + C.FOODS.length + ' 种常见食物，先点食物，再定克数</p></div>' +
          '<button type="button" class="icon-btn" data-act="close-sheet" aria-label="关闭">✕</button>' +
        '</div>' +
        '<div class="sheet-body picker">' +
          '<input id="foodSearch" class="field" type="search" placeholder="搜食物：米饭、鸡胸、牛奶…" aria-label="搜索食物" autocomplete="off">' +
          foodGroupChips() +
          '<div id="foodList">' + foodListHtml('', sheet.group) + '</div>' +
          '<p class="src-note">数据：' + C.DATA_SOURCE + '；标「熟重 / 干重」的按括号里的形态称重。</p>' +
          '<button type="button" class="btn ghost block" data-act="open-custom">找不到？自定义一份</button>' +
        '</div>';
    }

    if (sheet.type === 'custom') {
      return '<form data-form="add-custom">' +
        sheetHead('自定义一份', '按这份实际吃进去的克数填，记个大概也有用。') +
        '<div class="sheet-body">' +
          '<div class="field"><label for="cfName">名称</label>' +
            '<div class="input-wrap"><input id="cfName" name="name" maxlength="20" placeholder="比如：食堂盖饭" required></div></div>' +
          '<div class="field-row">' +
            '<div class="field"><label for="cfCarb">碳水</label><div class="input-wrap"><input id="cfCarb" name="carb" type="number" inputmode="decimal" min="0" step="0.1" placeholder="0"><span class="suffix">g</span></div></div>' +
            '<div class="field"><label for="cfPro">蛋白</label><div class="input-wrap"><input id="cfPro" name="protein" type="number" inputmode="decimal" min="0" step="0.1" placeholder="0"><span class="suffix">g</span></div></div>' +
          '</div>' +
          '<div class="field"><label for="cfFat">脂肪</label><div class="input-wrap"><input id="cfFat" name="fat" type="number" inputmode="decimal" min="0" step="0.1" placeholder="0"><span class="suffix">g</span></div></div>' +
        '</div>' +
        '<button class="btn primary block" type="submit">加入今日</button>' +
      '</form>';
    }

    if (sheet.type === 'workout') {
      var wDateK = sheet.date || C.todayKey();
      return '<form data-form="workout">' +
        sheetHead('记一次训练', '训练只做记录，不会改动碳水和热量目标。') +
        '<div class="sheet-body">' +
          '<div class="field"><span class="fld-label">类型</span>' +
            '<div class="seg" role="group" aria-label="训练类型">' +
              C.WORKOUT_TYPES.map(function (t, i) {
                return '<button type="button" class="seg-btn' + (i === 0 ? ' is-on' : '') + '" data-wtype="' + t.key + '">' + t.label + '</button>';
              }).join('') +
            '</div>' +
            '<input type="hidden" id="wkType" name="type" value="' + C.WORKOUT_TYPES[0].key + '">' +
          '</div>' +
          '<div class="field" style="margin-top:12px"><label for="wkMin">时长</label>' +
            '<div class="input-wrap"><input id="wkMin" name="minutes" type="number" inputmode="numeric" min="1" max="300" step="5" value="45" aria-label="训练时长"><span class="suffix">分钟</span></div></div>' +
          '<div class="field" style="margin-top:12px"><label for="wkDate">日期</label>' +
            '<div class="input-wrap"><input id="wkDate" name="date" type="date" value="' + wDateK + '" max="' + C.todayKey() + '" aria-label="训练日期"></div></div>' +
        '</div>' +
        '<button class="btn primary block" type="submit">保存</button>' +
      '</form>';
    }


    if (sheet.type === 'rules') {
      return sheetHead('532 规则', '五条，按顺序执行就行。') +
        '<div class="sheet-body">' + rulesHtml() + '</div>' +
        '<button class="btn primary block" type="button" data-act="close-sheet">知道了</button>';
    }

    if (sheet.type === 'weigh') {
      var wKey = sheet.date || C.todayKey();
      var wExact = null;
      for (var i = 0; i < state.weights.length; i++) {
        if (state.weights[i].date === wKey) wExact = state.weights[i].kg;
      }
      var wLast = C.latestWeight(state);
      var isToday = wKey === C.todayKey();
      var wHint = wExact == null && wLast
        ? '上次 ' + n1(wLast.kg) + ' kg（' + md(wLast.date) + '），今天还没记。'
        : '每天可以记一次，同一天再记会覆盖；第 7 天的记录用于这一周结算。';
      return '<form data-form="weigh" data-date="' + wKey + '">' +
        sheetHead(isToday ? '记录体重' : '补记体重', '晨起、空腹、上完厕所，每天同一时间最准。') +
        '<div class="sheet-body">' +
          '<label class="input-wrap big"><input name="kg" type="number" inputmode="decimal" step="0.1" min="20" max="400" value="' + (wExact != null ? n1(wExact) : '') + '" placeholder="' + (wExact != null ? '0.0' : (wLast ? n1(wLast.kg) : '0.0')) + '" aria-label="体重"><span class="suffix">kg</span></label>' +
          '<div class="field" style="margin-top:12px"><label for="wDate">日期</label>' +
            '<div class="input-wrap"><input id="wDate" name="date" type="date" value="' + wKey + '" max="' + C.todayKey() + '" aria-label="记录日期"></div></div>' +
          '<p class="fine">' + wHint + '</p>' +
        '</div>' +
        '<button class="btn primary block" type="submit">保存</button>' +
      '</form>';
    }

    if (sheet.type === 'profile') {
      var p = state.profile;
      var draft = sheet.draft;
      return '<form data-form="profile">' +
        sheetHead('个人资料', '改完会按最新体重重算基准热量，已下调的碳水保留。') +
        '<div class="sheet-body">' +
          '<div class="field"><label>性别</label><div class="seg">' +
            '<button type="button" class="seg-btn' + (draft.sex === 'male' ? ' is-on' : '') + '" data-sheet-sex="male">男</button>' +
            '<button type="button" class="seg-btn' + (draft.sex === 'female' ? ' is-on' : '') + '" data-sheet-sex="female">女</button>' +
          '</div></div>' +
          '<div class="field-row">' +
            '<div class="field"><label for="pfAge">年龄</label><div class="input-wrap"><input id="pfAge" name="age" type="number" inputmode="numeric" min="14" max="80" value="' + p.age + '"><span class="suffix">岁</span></div></div>' +
            '<div class="field"><label for="pfHeight">身高</label><div class="input-wrap"><input id="pfHeight" name="height" type="number" inputmode="decimal" min="120" max="230" value="' + p.height + '"><span class="suffix">cm</span></div></div>' +
          '</div>' +
          '<div class="field"><label>训练强度</label><div class="choices">' +
            C.ACTIVITY_LIST.map(function (a) {
              return '<button type="button" class="choice' + (draft.activity === a.key ? ' is-on' : '') + '" data-sheet-act="' + a.key + '">' +
                '<span class="choice-top"><b>' + a.label + '</b><i>×' + a.factor + '</i></span>' +
                '<span class="choice-hint">' + a.hint + '</span></button>';
            }).join('') +
          '</div></div>' +
          '<div class="field"><label for="pfGoal">目标体重 <span class="opt">可选</span></label><div class="input-wrap"><input id="pfGoal" name="goalWeight" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="' + (p.goalWeight || '') + '" placeholder="—"><span class="suffix">kg</span></div></div>' +
        '</div>' +
        '<button class="btn primary block" type="submit">保存并重算基准</button>' +
      '</form>';
    }

    return '';
  }

  function bindSheet() {
    if (!sheet) return;

    if (sheet.type === 'workout') {
      var typed = $('#wkType');
      var chips = $$('[data-wtype]', $('#sheetBody'));
      chips.forEach(function (b) {
        b.addEventListener('click', function () {
          if (typed) typed.value = b.dataset.wtype;
          chips.forEach(function (x) { x.classList.toggle('is-on', x === b); });
        });
      });
      return;
    }

    if (sheet.type === 'picker') {
      var search = $('#foodSearch');
      var list = $('#foodList');
      if (search && list) {
        search.addEventListener('input', function () {
          if (search.value.trim() && sheet.group && sheet.group !== 'all') {
            sheet.group = 'all';
            $$('.food-tab', $('#sheetBody')).forEach(function (t) {
              t.classList.toggle('is-on', t.dataset.group === 'all');
            });
          }
          list.innerHTML = foodListHtml(search.value, sheet.group);
        });
      }
      return;
    }

    if (sheet.type === 'food') {
      var input = $('#foodGrams');
      var f = sheet.food;
      function refresh() {
        var g = C.toNum(input.value);
        var m = C.foodMacros(f, g);
        $('#foodSum').innerHTML =
          '<span>碳水 <b>' + n1(m.carb) + '</b> g</span>' +
          '<span>蛋白 <b>' + n1(m.protein) + '</b> g</span>' +
          '<span>脂肪 <b>' + n1(m.fat) + '</b> g</span>' +
          '<span>约 <b>' + n0(m.carb * 4 + m.protein * 4 + m.fat * 9) + '</b> kcal</span>';
        $$('.gbtn', $('#sheetBody')).forEach(function (b) {
          b.classList.toggle('is-on', Number(b.dataset.g) === Math.round(g));
        });
      }
      input.addEventListener('input', refresh);
      $$('.gbtn', $('#sheetBody')).forEach(function (b) {
        b.addEventListener('click', function () {
          input.value = b.dataset.g;
          refresh();
        });
      });
      refresh();
    }

    if (sheet.type === 'profile') {
      $$('[data-sheet-sex]', $('#sheetBody')).forEach(function (b) {
        b.addEventListener('click', function () {
          sheet.draft.sex = b.dataset.sheetSex;
          $$('[data-sheet-sex]', $('#sheetBody')).forEach(function (x) { x.classList.toggle('is-on', x === b); });
        });
      });
      $$('[data-sheet-act]', $('#sheetBody')).forEach(function (b) {
        b.addEventListener('click', function () {
          sheet.draft.activity = b.dataset.sheetAct;
          $$('[data-sheet-act]', $('#sheetBody')).forEach(function (x) { x.classList.toggle('is-on', x === b); });
        });
      });
    }
  }

  function openFood(id, fromPicker, editId) {
    var f = C.FOODS.filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    var entry = null;
    if (editId) {
      var list = state.foods[C.todayKey()] || [];
      entry = list.filter(function (x) { return x.id === editId; })[0] || null;
    }
    openSheet({ type: 'food', food: f, back: fromPicker ? 'picker' : null, editId: editId, grams: entry ? entry.grams : null });
  }

  function foodKcal(f) {
    return Math.round(f.carb * 4 + f.protein * 4 + f.fat * 9);
  }

  function foodRow(f) {
    var fav = C.isFavorite(state, f.id);
    return '<div class="food-row">' +
      '<button type="button" class="food-main" data-act="open-food" data-food="' + f.id + '">' +
        '<span class="food-name">' + esc(f.name) + '</span>' +
        '<span class="food-meta">碳水 ' + f.carb + ' g · ' + foodKcal(f) + ' kcal</span>' +
        '<span class="food-go" aria-hidden="true">›</span>' +
      '</button>' +
      '<button type="button" class="fav-btn' + (fav ? ' is-on' : '') + '" data-act="fav-food" data-id="' + f.id + '"' +
        ' aria-pressed="' + (fav ? 'true' : 'false') + '" aria-label="' + (fav ? '取消收藏 ' : '收藏 ') + esc(f.name) + '">' +
        (fav ? '★' : '☆') + '</button>' +
    '</div>';
  }

  function foodMatch(f, q) {
    if (!q) return true;
    var hay = (f.name + ' ' + (f.alt || '')).toLowerCase();
    return hay.indexOf(q.toLowerCase()) >= 0;
  }

  function foodGroupChips() {
    var cur = (sheet && sheet.group) || 'all';
    var tabs = [{ key: 'all', label: '全部' }].concat(C.FOOD_GROUPS);
    return '<div class="food-tabs" role="group" aria-label="食物分类">' +
      tabs.map(function (g) {
        return '<button type="button" class="food-tab' + (cur === g.key ? ' is-on' : '') + '" data-act="food-group" data-group="' + g.key + '">' + g.label + '</button>';
      }).join('') +
    '</div>';
  }

  function foodListHtml(q, group) {
    q = String(q || '').trim();
    group = group || 'all';
    var scoped = q ? 'all' : group;
    var items = C.FOODS.filter(function (f) {
      return (scoped === 'all' || f.g === scoped) && foodMatch(f, q);
    });

    if (q) {
      if (!items.length) return '<p class="empty">没找到「' + esc(q) + '」，换个词或自己填一份。</p>';
      return '<div class="food-rows">' + items.map(foodRow).join('') + '</div>';
    }

    if (group !== 'all') {
      var label = '';
      C.FOOD_GROUPS.forEach(function (g) { if (g.key === group) label = g.label; });
      return '<div class="food-group"><div class="food-group-title">' + label + ' · ' + items.length + ' 种</div>' +
        '<div class="food-rows">' + items.map(foodRow).join('') + '</div></div>';
    }

    var html = '';
    var shown = [];
    var favs = C.favoriteFoods(state);
    if (favs.length) {
      shown = shown.concat(favs.map(function (f) { return f.id; }));
      html += '<div class="food-group"><div class="food-group-title">收藏 · ' + favs.length + ' 种</div>' +
        '<div class="food-rows">' + favs.map(foodRow).join('') + '</div></div>';
    }
    var recents = recentFoods(4).filter(function (f) { return shown.indexOf(f.id) < 0; });
    if (recents.length) {
      shown = shown.concat(recents.map(function (f) { return f.id; }));
      html += '<div class="food-group"><div class="food-group-title">最近常吃</div>' +
        '<div class="food-rows">' + recents.map(foodRow).join('') + '</div></div>';
    }

    var rest = 0;
    C.FOOD_GROUPS.forEach(function (g) {
      var rows = C.FOODS.filter(function (f) {
        return f.g === g.key && shown.indexOf(f.id) < 0;
      });
      if (!rows.length) return;
      rest += rows.length;
      html += '<div class="food-group"><div class="food-group-title">' + g.label + ' · ' + rows.length + ' 种</div>' +
        '<div class="food-rows">' + rows.map(foodRow).join('') + '</div></div>';
    });
    if (!rest) html += '<p class="empty">都看过了。换个分组，或直接搜名字。</p>';

    return html;
  }

  /* ---------------- 弹窗 ---------------- */

  var confirmHandler = null;
  var lastFocus = null;

  function rememberFocus() {
    lastFocus = document.activeElement && document.activeElement.focus ? document.activeElement : null;
  }

  function restoreFocus() {
    if (lastFocus && document.contains(lastFocus)) {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) { lastFocus.focus(); }
    }
    lastFocus = null;
  }

  function focusables(box) {
    var sel = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(box.querySelectorAll(sel)).filter(function (el) {
      return el.getClientRects().length > 0;
    });
  }

  function wrapFocus(box, backwards) {
    var list = focusables(box);
    if (!list.length) return;
    var active = document.activeElement;
    var inside = box.contains(active);
    if (backwards) {
      if (!inside || active === list[0]) list[list.length - 1].focus();
    } else if (!inside || active === list[list.length - 1]) {
      list[0].focus();
    }
  }

  function askConfirm(title, body, okLabel, onOk, danger) {
    rememberFocus();
    $('#modalTitle').textContent = title;
    $('#modalBody').textContent = body;
    var ok = $('#modalOk');
    ok.textContent = okLabel || '确定';
    ok.className = 'btn ' + (danger ? 'danger' : 'primary');
    confirmHandler = onOk;
    $('#modalLayer').hidden = false;
  }

  function closeModal() {
    $('#modalLayer').hidden = true;
    confirmHandler = null;
    restoreFocus();
  }

  /* ---------------- 业务动作 ---------------- */

  function addFood(food, grams) {
    var key = C.todayKey();
    var m = C.foodMacros(food, grams);
    if (!state.foods[key]) state.foods[key] = [];
    state.foods[key].push({
      id: C.newId(),
      foodId: food.id,
      name: food.name,
      grams: Math.round(grams),
      carb: m.carb,
      protein: m.protein,
      fat: m.fat
    });
    saveState();
    render();
    toast('已加入 ' + Math.round(grams) + ' g ' + food.name);
  }

  function updateFood(food, entryId, grams) {
    var key = C.todayKey();
    var list = state.foods[key] || [];
    var e = list.filter(function (x) { return x.id === entryId; })[0];
    if (!e) { toast('这条记录找不到了'); return; }
    var m = C.foodMacros(food, grams);
    e.grams = Math.round(grams);
    e.carb = m.carb;
    e.protein = m.protein;
    e.fat = m.fat;
    saveState();
    render();
    toast('已更新为 ' + Math.round(grams) + ' g');
  }

  function settle(week, weight) {
    if (!(weight >= 20 && weight <= 400)) { toast('体重看起来不太对'); return; }
    var scheduled = C.checkinKey(state.startDate, week);
    if (Math.abs(C.diffDaysKeys(scheduled, C.todayKey())) <= 1) {
      C.upsertWeight(state, C.todayKey(), weight);
    }
    var res = C.settleWeek(state, week, weight);
    state.checkins.push(res.checkin);
    if (res.pending) state.pendings.push(res.pending);
    saveState();
    render();

    if (res.checkin.hit) {
      toast(res.checkin.fast ? '达标，但掉得偏快，留意状态' : '达标，饮食保持不动');
    } else {
      toast('差 ' + n2(res.checkin.target - res.checkin.actual) + ' kg，3 天后提示下调碳水');
    }
  }

  function applyCut(i) {
    var p = state.pendings[i];
    if (!p) return;
    if (C.diffDaysKeys(p.dueDate, C.todayKey()) < 0) { toast('还没到下调日期'); return; }
    var before = C.currentTargets(state.plan).carb;
    C.applyCarbCut(state, p);
    var after = C.currentTargets(state.plan).carb;
    saveState();
    render();
    if (after < 50) toast('碳水已到 ' + after + ' g，偏低，注意状态和电解质');
    else toast('碳水 ' + before + ' → ' + after + ' g');
  }

  function holdCut(i) {
    var p = state.pendings[i];
    if (!p) return;
    state.checkins.forEach(function (c) {
      if (c.week === p.week) c.action = 'hold';
    });
    state.pendings.splice(i, 1);
    saveState();
    render();
    toast('这周先保持，下周再看');
  }

  function logCheat() {
    var key = C.todayKey();
    if (state.cheats.indexOf(key) >= 0) { toast('今天已经记过了'); return; }
    state.cheats.push(key);
    saveState();
    render();
    toast('记下了，吃完不用补救');
  }

  function undoCheat() {
    if (!state.cheats.length) return;
    state.cheats.pop();
    saveState();
    render();
    toast('已撤销');
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    var url = URL.createObjectURL(blob);
    a.href = url;
    a.download = '532-backup-' + C.todayKey() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast('已导出 JSON 备份');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(String(reader.result));
      } catch (e) {
        toast('文件读不出来，不是有效的 JSON');
        return;
      }
      if (!data || data.version !== C.VERSION || !data.plan || !data.profile || !data.startDate) {
        toast('备份格式不对');
        return;
      }
      askConfirm('导入这份备份？', '会覆盖当前全部记录：' + data.startDate + ' 开始的方案。', '导入', function () {
        data.pendings = data.pendings || [];
        data.cheats = data.cheats || [];
        data.foods = data.foods || {};
        data.weights = data.weights || [];
        data.checkins = data.checkins || [];
        data.settings = data.settings || { theme: 'auto' };
        state = data;
        view = 'today';
        saveState();
        render({ scroll: true });
        toast('导入完成');
      });
    };
    reader.readAsText(file);
  }

  function resetAll() {
    askConfirm('清空全部记录？', '方案、体重、饮食记录都会删除，且无法恢复。建议先导出备份。', '清空', function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      state = null;
      view = 'today';
      closeModal();
      ['age', 'height', 'weight', 'goalWeight'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      setup = { sex: 'male', activity: 'hobby' };
      $$('.seg-btn[data-sex]').forEach(function (x) {
        var on = x.dataset.sex === 'male';
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      $$('.choice[data-activity]').forEach(function (x) {
        var on = x.dataset.activity === 'hobby';
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      updatePreview();
      render();
      window.scrollTo(0, 0);
      toast('已清空，可以重新开始');
    }, true);
  }

  function openProfile() {
    var p = state.profile;
    openSheet({
      type: 'profile',
      draft: { sex: p.sex, activity: p.activity }
    });
  }

  function saveProfile(form) {
    var draft = sheet.draft;
    var age = C.toNum(form.age.value);
    var height = C.toNum(form.height.value);
    var goalWeight = C.toNum(form.goalWeight.value);
    var weightNow = C.latestWeight(state);
    var weight = weightNow ? weightNow.kg : state.profile.weightStart;
    var errs = C.validateProfile({ age: age, height: height, weight: weight, goalWeight: goalWeight });
    if (errs.length) { toast(errs[0]); return; }

    state.profile.sex = draft.sex;
    state.profile.age = age;
    state.profile.height = height;
    state.profile.activity = draft.activity;
    state.profile.goalWeight = goalWeight > 0 ? C.round(goalWeight, 1) : null;
    C.rebuildBase(state, weight);
    saveState();
    closeSheet();
    render();
    toast('资料已更新，基准热量重算');
  }

  /* ---------------- 事件 ---------------- */

  function handleForm(form) {
    var type = form.dataset.form;

    if (type === 'settle') {
      var week = Number(form.dataset.week);
      var w = parseFloat(form.w.value);
      settle(week, w);
      return;
    }

    if (type === 'weigh') {
      var kg = parseFloat(form.kg.value);
      if (!(kg >= 20 && kg <= 400)) { toast('体重看起来不太对'); return; }
      var key = (form.date && form.date.value) || form.dataset.date || C.todayKey();
      if (C.diffDaysKeys(key, C.todayKey()) < 0) { toast('还不能记以后的体重'); return; }
      var isSheet = !!form.closest('#sheetBody');
      C.upsertWeight(state, key, kg);
      saveState();
      if (isSheet) closeSheet();
      render();
      toast('已记录 ' + n1(kg) + ' kg' + (key === C.todayKey() ? '' : '（' + md(key) + '）'));
      return;
    }

    if (type === 'workout') {
      var wType = form.type.value || 'other';
      var wMin = parseFloat(form.minutes.value);
      var wKey = (form.date && form.date.value) || C.todayKey();
      if (!(wMin >= 1 && wMin <= 300)) { toast('时长填 1–300 分钟'); return; }
      if (C.diffDaysKeys(wKey, C.todayKey()) < 0) { toast('还不能记以后的训练'); return; }
      C.addWorkout(state, { date: wKey, type: wType, minutes: wMin });
      saveState();
      closeSheet();
      render();
      toast('已记下 ' + C.workoutLabel(wType) + ' ' + wMin + ' 分钟');
      return;
    }

    if (type === 'add-food') {
      var food = C.FOODS.filter(function (x) { return x.id === form.dataset.food; })[0];
      var grams = parseFloat(form.grams.value);
      if (!food || !(grams > 0)) { toast('克数填一下'); return; }
      var editId = form.dataset.edit;
      closeSheet();
      if (editId) {
        updateFood(food, editId, grams);
        return;
      }
      addFood(food, grams);
      return;
    }

    if (type === 'add-custom') {
      var name = String(form.name.value || '').trim();
      if (!name) { toast('给它起个名字'); return; }
      var c = C.toNum(form.carb.value);
      var p = C.toNum(form.protein.value);
      var f = C.toNum(form.fat.value);
      if (c <= 0 && p <= 0 && f <= 0) { toast('至少填一项营养值'); return; }
      var key = C.todayKey();
      if (!state.foods[key]) state.foods[key] = [];
      state.foods[key].push({ id: C.newId(), name: name, grams: 0, carb: C.round(c, 1), protein: C.round(p, 1), fat: C.round(f, 1) });
      saveState();
      closeSheet();
      render();
      toast('已加入：' + name);
      return;
    }

    if (type === 'profile') {
      saveProfile(form);
      return;
    }

    if (type === 'override') {
      var kcal = C.toNum(form.kcal.value);
      var weightNow = C.latestWeight(state);
      if (kcal && (kcal < 800 || kcal > 6000)) { toast('总消耗请填 800–6000'); return; }
      if (kcal) {
        askConfirm('手动指定总消耗？', '将按 ' + n0(kcal) + ' kcal 重算 5:3:2 的克数，已下调的碳水保留。', '应用', function () {
          C.rebuildBase(state, weightNow ? weightNow.kg : state.profile.weightStart, kcal);
          saveState();
          render();
          toast('已按 ' + n0(kcal) + ' kcal 重算');
        });
      } else {
        C.rebuildBase(state, weightNow ? weightNow.kg : state.profile.weightStart, 0);
        saveState();
        render();
        toast('已改回公式计算');
      }
      return;
    }
  }

  function handleAct(act, el) {
    switch (act) {
      case 'close-sheet': closeSheet(); break;
      case 'close-modal': closeModal(); break;
      case 'open-food': openFood(el.dataset.food, sheet && sheet.type === 'picker'); break;
      case 'edit-food': openFood(el.dataset.food, false, el.dataset.id); break;
      case 'open-picker': openSheet({ type: 'picker' }); break;
      case 'open-rules': openSheet({ type: 'rules' }); break;
    case 'rv-prev': reviewWeek = Math.max(1, (reviewWeek == null ? C.weekOf(state.startDate, C.todayKey()).week : reviewWeek) - 1); render({ scroll: true }); break;
    case 'rv-next': reviewWeek = Math.min(C.weekOf(state.startDate, C.todayKey()).week, (reviewWeek == null ? C.weekOf(state.startDate, C.todayKey()).week : reviewWeek) + 1); render({ scroll: true }); break;
      case 'food-group':
        if (!sheet) break;
        sheet.group = el.dataset.group || 'all';
        $$('.food-tab').forEach(function (b) { b.classList.toggle('is-on', b.dataset.group === sheet.group); });
        var flist = $('#foodList');
        var fsearch = $('#foodSearch');
        if (flist) flist.innerHTML = foodListHtml(fsearch ? fsearch.value : '', sheet.group);
        break;
      case 'fav-food':
        if (!sheet) break;
        var favOn = C.toggleFavorite(state, el.dataset.id);
        saveState();
        var favList = $('#foodList');
        if (favList) {
          var favSearch = $('#foodSearch');
          var favTop = favList.scrollTop;
          favList.innerHTML = foodListHtml(favSearch ? favSearch.value : '', sheet.group);
          favList.scrollTop = favTop;
        }
        toast(favOn ? '已收藏，置顶在列表里' : '已取消收藏');
        break;
      case 'back-picker': openSheet({ type: 'picker' }); break;
      case 'open-custom': openSheet({ type: 'custom' }); break;
      case 'open-weigh': openSheet({ type: 'weigh', date: el.dataset.date || C.todayKey() }); break;
      case 'edit-weigh':
        openSheet({ type: 'weigh', date: el.dataset.date });
        break;
      case 'open-profile': openProfile(); break;
      case 'del-food':
        var key = C.todayKey();
        var id = el.dataset.id;
        var list = state.foods[key] || [];
        var idx = -1;
        for (var fi = 0; fi < list.length; fi++) if (list[fi].id === id) idx = fi;
        if (idx < 0) break;
        var removed = list[idx];
        state.foods[key] = list.filter(function (x) { return x.id !== id; });
        saveState();
        render();
        toast('已删除 ' + (removed.name || '这条记录'), '撤销', function () {
          state.foods[key] = state.foods[key] || [];
          state.foods[key].splice(Math.min(idx, state.foods[key].length), 0, removed);
          saveState();
          render();
          toast('已恢复');
        });
        break;
      case 'open-workout': openSheet({ type: 'workout' }); break;
      case 'del-workout':
        var wid = el.dataset.id;
        var gone = null;
        var allW = state.workouts || [];
        for (var wi = 0; wi < allW.length; wi++) if (allW[wi].id === wid) gone = allW[wi];
        if (!gone) break;
        C.removeWorkout(state, wid);
        saveState();
        render();
        toast('已删除这次训练', '撤销', function () {
          state.workouts.push(gone);
          state.workouts.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
          saveState();
          render();
          toast('已恢复');
        });
        break;
      case 'apply-cut': applyCut(Number(el.dataset.i)); break;
      case 'toast-act':
        var tfn = toastHandler;
        toastHandler = null;
        $('#toast').classList.remove('is-on');
        if (tfn) tfn();
        break;
      case 'hold-cut': holdCut(Number(el.dataset.i)); break;
      case 'log-cheat': logCheat(); break;
      case 'undo-cheat': undoCheat(); break;
      case 'export': exportData(); break;
      case 'import': $('#importFile').click(); break;
      case 'reset': resetAll(); break;
      case 'recalc':
        var last = C.latestWeight(state);
        askConfirm('按当前体重重算？', '会用 ' + n1(last ? last.kg : state.profile.weightStart) + ' kg 重算基础代谢和 5:3:2 克数，已下调的碳水保留。', '重算', function () {
          C.rebuildBase(state, last ? last.kg : state.profile.weightStart);
          saveState();
          render();
          toast('基准已重算');
        });
        break;
      case 'install':
        if (deferredPrompt) {
          deferredPrompt.prompt();
          var ev = deferredPrompt;
          deferredPrompt = null;
          ev.userChoice.then(function () {
            var btn = $('#installBtn');
            if (btn) btn.hidden = true;
          });
        } else {
          toast('用浏览器菜单里的「安装 / 添加到主屏幕」');
        }
        break;
    }
  }

  function initEvents() {
    bindSheetDrag();
    document.addEventListener('click', function (e) {
      var tab = e.target.closest('.tab');
      if (tab && tab.dataset.view) {
        view = tab.dataset.view;
        render({ scroll: true });
        return;
      }

      var themeBtn = e.target.closest('[data-theme-set]');
      if (themeBtn) {
        state.settings.theme = themeBtn.dataset.themeSet;
        saveState();
        render();
        toast('主题已切换');
        return;
      }

      var scaleBtn = e.target.closest('[data-text-scale]');
      if (scaleBtn) {
        var sc = Number(scaleBtn.dataset.textScale) || 1;
        state.settings.textScale = sc;
        saveState();
        render();
        toast(sc === 1 ? '文字大小：标准' : sc === 1.15 ? '文字大小：大' : '文字大小：特大');
        return;
      }

      var el = e.target.closest('[data-act]');
      if (el) handleAct(el.dataset.act, el);
    });

    document.addEventListener('submit', function (e) {
      var form = e.target.closest('form[data-form]');
      if (!form) return;
      e.preventDefault();
      handleForm(form);
    });

    document.addEventListener('change', function (e) {
      var el = e.target;

      if (el.id === 'importFile') {
        var file = el.files && el.files[0];
        el.value = '';
        if (file) importData(file);
        return;
      }

      if (el.dataset && el.dataset.set) {
        var key = el.dataset.set;
        if (key === 'theme') {
          state.settings.theme = (el.value === 'light' || el.value === 'dark') ? el.value : 'auto';
          saveState();
          render();
          toast(el.value === 'auto' ? '外观：跟随系统' : el.value === 'light' ? '外观：浅色' : '外观：深色');
          return;
        }
        if (key === 'textScale') {
          state.settings.textScale = Number(el.value) || 1;
          saveState();
          render();
          return;
        }
        var val = Number(el.value);
        if (key === 'monthPct' && val > 0) {
          state.plan.monthPct = val;
          saveState();
          render();
          toast('目标改为每月 −' + val + '%');
        }
        if (key === 'stepG' && val > 0) {
          state.plan.stepG = val;
          saveState();
          render();
          toast('每次调碳 −' + val + ' g');
        }
      }
    });

    $('#modalOk').addEventListener('click', function () {
      var fn = confirmHandler;
      closeModal();
      if (fn) fn();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('#modalLayer').hidden) closeModal();
        else if (!$('#sheetLayer').hidden) closeSheet();
        return;
      }
      if (e.key !== 'Tab') return;
      var box = !$('#modalLayer').hidden ? $('#modalLayer') : (!$('#sheetLayer').hidden ? $('#sheetLayer') : null);
      if (!box) return;
      var before = document.activeElement;
      wrapFocus(box, e.shiftKey);
      if (document.activeElement !== before) e.preventDefault();
    });

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      var btn = $('#installBtn');
      if (btn) btn.hidden = false;
    });

    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      toast('已安装到主屏');
    });
  }

  /* ---------------- 启动 ---------------- */

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  function init() {
    state = loadState();
    initSetup();
    initEvents();
    render();
    registerSW();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
