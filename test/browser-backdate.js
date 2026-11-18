(function () {
  var KEY = 'carb532.state.v1';
  var s = JSON.parse(localStorage.getItem(KEY));
  s.startDate = '2026-11-10';
  s.weights = [
    { date: '2026-11-10', kg: 80.0 },
    { date: '2026-11-17', kg: 79.7 }
  ];
  s.checkins = [];
  s.pendings = [];
  s.foods = {};
  s.cheats = [];
  localStorage.setItem(KEY, JSON.stringify(s));
  return 'backdated: ' + s.startDate;
})()
