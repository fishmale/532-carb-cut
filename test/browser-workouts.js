(function () {
  var s = JSON.parse(localStorage.getItem('carb532.state.v1'));
  var C = window.Carb532;
  s.workouts = [];
  var t = C.todayKey();
  C.addWorkout(s, { date: C.addDaysKey(t, -1), type: 'strength', minutes: 50 });
  C.addWorkout(s, { date: t, type: 'cardio', minutes: 30 });
  C.addWorkout(s, { date: C.addDaysKey(t, -3), type: 'ball', minutes: 60 });
  localStorage.setItem('carb532.state.v1', JSON.stringify(s));
  return JSON.stringify({ workouts: s.workouts.length });
})()
