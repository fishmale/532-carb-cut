(function () {
  var C = window.Carb532;
  var KEY = 'carb532.state.v1';
  var s = JSON.parse(localStorage.getItem(KEY));
  var start = '2026-10-21';

  s.startDate = start;
  s.profile.weightStart = 80.6;
  s.profile.goalWeight = 72;
  s.plan.adjustments = [];
  C.rebuildBase(s, 80.6);

  var w = [80.6, 80.3, 80.4, 80.1, 80.0, 80.2, 79.9, 79.8, 79.9, 79.6,
           79.5, 79.7, 79.4, 79.3, 79.4, 79.1, 79.0, 79.2, 78.9, 78.8,
           79.0, 78.7, 78.5, 78.6, 78.4, 78.3, 78.5, 78.2];
  s.weights = w.map(function (kg, i) { return { date: C.addDaysKey(start, i), kg: kg }; });

  s.checkins = [];
  s.pendings = [];
  s.foods = {};
  s.cheats = ['2026-11-08', '2026-10-27'];

  var plan = [
    { week: 1, end: 79.9, apply: false },
    { week: 2, end: 79.6, apply: true },
    { week: 3, end: 79.2, apply: true },
    { week: 4, end: 78.8, apply: false }
  ];

  plan.forEach(function (p) {
    var r = C.settleWeek(s, p.week, p.end);
    s.checkins.push(r.checkin);
    if (r.pending) {
      s.pendings.push(r.pending);
      if (p.apply) {
        r.pending.dueDate = C.addDaysKey(r.pending.dueDate, -30);
        C.applyCarbCut(s, r.pending);
        s.plan.adjustments[s.plan.adjustments.length - 1].date = r.checkin.date;
      }
    }
  });

  localStorage.setItem(KEY, JSON.stringify(s));
  return JSON.stringify({ carb: s.plan.base.carb, adj: s.plan.adjustments.length, pendings: s.pendings.length });
})()
