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
  var sheet = null;
  var setup = { sex: 'male', activity: 'hobby' };
  var deferredPrompt = null;
  var toastTimer = null;

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

  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 2400);
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

  function applyTheme() {
    var t = state ? (state.settings.theme || 'auto') : 'auto';
    document.documentElement.setAttribute('data-theme', t);
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

    $$('.tab').forEach(function (t) {
      var on = t.dataset.view === view;
      t.classList.toggle('is-on', on);
      if (on) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });

    var map = { today: viewToday, log: viewLog, plan: viewPlan, me: viewMe };
    $('#main').innerHTML = (map[view] || viewToday)();

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
          '<div class="quickadd-head"><span class="overline">快速添加</span><button type="button" class="link" data-act="open-custom">自定义一份</button></div>' +
          '<div class="chips">' +
            C.FOODS.map(function (f) {
              return '<button type="button" class="chip-food" data-act="open-food" data-food="' + f.id + '">' +
                '<b>' + esc(f.name) + '</b><span>' + f.portion + ' g</span></button>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</section>'
    );

    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>今日记录</h2><span class="muted small">' + (entries.length ? entries.length + ' 项' : '') + '</span></div>' +
        (entries.length
          ? '<ul class="loglist">' + entries.map(function (e) {
              return '<li>' +
                '<div class="log-main"><b>' + esc(e.name) + '</b>' +
                '<span>' + (e.grams ? n0(e.grams) + ' g · ' : '') + '碳 ' + n1(e.carb) + ' · 蛋 ' + n1(e.protein) + ' · 脂 ' + n1(e.fat) + '</span></div>' +
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
      '<div class="card-head"><span class="pill">调碳待执行</span><span class="muted small">第 ' + p.week + ' 周没达标</span></div>' +
      '<p class="alert-p">按方案下调 <b>−' + p.amount + ' g</b> 碳水，约 <b>−' + (p.amount * 4) + ' kcal/天</b>。</p>' +
      '<p class="fine">' + (can ? '已经可以执行了。' : '等 ' + wait + ' 天，' + md(p.dueDate) + ' 起再降，别一次降太猛。') + '</p>' +
      '<div class="btn-row">' +
        '<button type="button" class="btn primary" data-act="apply-cut" data-i="' + i + '"' + (can ? '' : ' disabled') + '>执行 −' + p.amount + ' g</button>' +
        '<button type="button" class="btn ghost" data-act="hold-cut" data-i="' + i + '">本周先不动</button>' +
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
          '<label class="input-wrap"><input name="kg" type="number" step="0.1" inputmode="decimal" value="' + (last ? n1(last.kg) : '') + '" placeholder="今晨体重" aria-label="今天体重" required><span class="suffix">kg</span></label>' +
          '<button class="btn primary" type="submit">保存</button>' +
        '</form>' +
        '<div class="stat-row">' +
          '<div><span class="k">本周</span><b class="' + (weekDelta < 0 ? 'good' : '') + '">' + signed(weekDelta) + '<small> kg</small></b></div>' +
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

    var list = state.checkins.slice().sort(function (a, b) { return b.week - a.week; });
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

  function weightChart() {
    var pts = C.sortedWeights(state);
    if (pts.length < 2) return '<p class="empty">记录 2 天以上就能看到曲线。</p>';

    var W = 340, H = 178, L = 30, R = 12, T = 18, B = 24;
    var t0 = C.fromKey(state.startDate).getTime();
    var t1 = Math.max(C.fromKey(C.todayKey()).getTime(), C.fromKey(pts[pts.length - 1].date).getTime());
    var span = Math.max(86400000 * 2, t1 - t0);
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

    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="体重曲线">';

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

    svg += '<text x="' + L + '" y="' + (H - 6) + '">' + md(state.startDate) + '</text>';
    svg += '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + md(C.todayKey()) + '</text>';
    svg += '</svg>';
    svg += '<div class="chart-foot"><span>起点 ' + n1(startW) + ' kg</span><span>现在 ' + n1(pts[pts.length - 1].kg) + ' kg</span></div>';

    return svg;
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
        '<div class="card-head"><h2>规则</h2><span class="muted small">' + n2(weekTarget) + ' kg / 周</span></div>' +
        '<ol class="rules">' +
          '<li><b>首周按总消耗吃。</b>基础代谢 + 体重 × ' + plan.factor + '（' + esc(act.label) + '），不刻意制造缺口。</li>' +
          '<li><b>5 : 3 : 2。</b>碳水 50%、蛋白 30%、脂肪 20%，按克数吃到就好。</li>' +
          '<li><b>每月减 ' + plan.monthPct + '% 体重。</b>当前约 ' + n2(weekTarget) + ' kg/周、' + n1(monthTarget) + ' kg/月，每天记录空腹体重。</li>' +
          '<li><b>只看第 7 天。</b>达标就不动；没达标等 3 天，再降 ' + plan.stepG + ' g 碳水。</li>' +
          '<li><b>放纵日 7–15 天一次。</b>放在晚上吃，不用补救。</li>' +
        '</ol>' +
      '</section>'
    );

    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>高级设置</h2><span class="muted small">改完立即生效</span></div>' +
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
      '</section>'
    );

    return parts.join('');
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

    var W = 340, H = 150, L = 30, R = 12, T = 14, B = 22;
    var minV = Math.min.apply(null, rows);
    var maxV = Math.max.apply(null, rows);
    var pad = Math.max(10, (maxV - minV) * 0.25);
    var lo = Math.max(0, minV - pad);
    var hi = maxV + pad * 0.6;
    var dx = (W - L - R) / totalWeeks;
    var y = function (v) { return T + ((hi - v) / (hi - lo)) * (H - T - B); };

    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="每周碳水目标阶梯图">';

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
        '<div class="card-head"><h2>外观</h2></div>' +
        '<div class="seg" role="group" aria-label="主题">' +
          '<button type="button" class="seg-btn' + (theme === 'auto' ? ' is-on' : '') + '" data-theme-set="auto">跟随系统</button>' +
          '<button type="button" class="seg-btn' + (theme === 'light' ? ' is-on' : '') + '" data-theme-set="light">浅色</button>' +
          '<button type="button" class="seg-btn' + (theme === 'dark' ? ' is-on' : '') + '" data-theme-set="dark">深色</button>' +
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
    sheet = cfg;
    $('#sheetBody').innerHTML = sheetHtml();
    $('#sheetLayer').hidden = false;
    document.body.classList.add('no-scroll');
    bindSheet();
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
  }

  function sheetHead(title, sub) {
    return '<div class="sheet-head"><div><h3 id="sheetTitle">' + title + '</h3>' +
      (sub ? '<p class="sheet-sub">' + sub + '</p>' : '') + '</div>' +
      '<button type="button" class="icon-btn" data-act="close-sheet" aria-label="关闭">✕</button></div>';
  }

  function sheetHtml() {
    if (!sheet) return '';

    if (sheet.type === 'food') {
      var f = sheet.food;
      return '<form data-form="add-food" data-food="' + f.id + '">' +
        sheetHead(esc(f.name), '每 100 g：碳水 ' + f.carb + ' g · 蛋白 ' + f.protein + ' g · 脂肪 ' + f.fat + ' g') +
        '<div class="sheet-body">' +
          '<div class="grams-row">' +
            [50, 100, 150, 200, 250].map(function (g) {
              return '<button type="button" class="gbtn' + (g === f.portion ? ' is-on' : '') + '" data-g="' + g + '">' + g + ' g</button>';
            }).join('') +
            '<label class="input-wrap"><input id="foodGrams" name="grams" type="number" inputmode="decimal" min="1" max="2000" step="1" value="' + f.portion + '" aria-label="克数"><span class="suffix">g</span></label>' +
          '</div>' +
          '<div class="sheet-sum" id="foodSum"></div>' +
        '</div>' +
        '<button class="btn primary block" type="submit">加入今日</button>' +
      '</form>';
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

    if (sheet.type === 'weigh') {
      var lastW = C.latestWeight(state);
      return '<form data-form="weigh">' +
        sheetHead('记录体重', '晨起、空腹、上完厕所，每天同一时间最准。') +
        '<div class="sheet-body">' +
          '<label class="input-wrap big"><input name="kg" type="number" inputmode="decimal" step="0.1" min="20" max="400" value="' + (lastW ? n1(lastW.kg) : '') + '" placeholder="0.0" aria-label="体重"><span class="suffix">kg</span></label>' +
          '<p class="fine">第 7 天的记录会用于这一周的结算。</p>' +
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

  function openFood(id) {
    var f = C.FOODS.filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    openSheet({ type: 'food', food: f });
  }

  /* ---------------- 弹窗 ---------------- */

  var confirmHandler = null;

  function askConfirm(title, body, okLabel, onOk, danger) {
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
  }

  /* ---------------- 业务动作 ---------------- */

  function addFood(food, grams) {
    var key = C.todayKey();
    var m = C.foodMacros(food, grams);
    if (!state.foods[key]) state.foods[key] = [];
    state.foods[key].push({
      id: C.newId(),
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
      var isSheet = !!form.closest('#sheetBody');
      C.upsertWeight(state, C.todayKey(), kg);
      saveState();
      if (isSheet) closeSheet();
      render();
      toast('已记录 ' + n1(kg) + ' kg');
      return;
    }

    if (type === 'add-food') {
      var food = C.FOODS.filter(function (x) { return x.id === form.dataset.food; })[0];
      var grams = parseFloat(form.grams.value);
      if (!food || !(grams > 0)) { toast('克数填一下'); return; }
      closeSheet();
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
      case 'open-food': openFood(el.dataset.food); break;
      case 'open-custom': openSheet({ type: 'custom' }); break;
      case 'open-weigh': openSheet({ type: 'weigh' }); break;
      case 'open-profile': openProfile(); break;
      case 'del-food':
        var key = C.todayKey();
        var id = el.dataset.id;
        state.foods[key] = (state.foods[key] || []).filter(function (x) { return x.id !== id; });
        saveState();
        render();
        toast('已删除');
        break;
      case 'apply-cut': applyCut(Number(el.dataset.i)); break;
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
      if (e.key !== 'Escape') return;
      if (!$('#modalLayer').hidden) closeModal();
      else if (!$('#sheetLayer').hidden) closeSheet();
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
