(function () {
  var KEY = 'carb532.state.v1';
  var C = window.Carb532;
  var s = JSON.parse(localStorage.getItem(KEY));
  var foods = {};
  C.FOODS.forEach(function (f) { foods[f.id] = f; });
  var rice = foods.rice, chicken = foods.chicken, oil = foods.oil;
  var t = C.currentTargets(s.plan);
  var today = C.todayKey();
  var d = s.startDate;
  var i = 0;

  function entry(f, grams) {
    var k = grams / 100;
    return {
      id: f.id, name: f.name, grams: grams,
      carb: Math.round(f.carb * k * 10) / 10,
      protein: Math.round(f.protein * k * 10) / 10,
      fat: Math.round(f.fat * k * 10) / 10
    };
  }

  while (d <= today) {
    var target = t.carb;
    var wave = ((i * 37) % 70) - 35;
    var carb = Math.max(120, target + wave);
    var list = [entry(rice, Math.round(carb / (rice.carb / 100)))];
    if (i % 3 !== 0) list.push(entry(chicken, 120));
    if (i % 4 === 0) list.push(entry(oil, 8));
    foods[d] = list;
    s.foods[d] = list;
    d = C.addDaysKey(d, 1);
    i++;
  }
  localStorage.setItem(KEY, JSON.stringify(s));
  return JSON.stringify({ days: i, foods: Object.keys(s.foods).length, target: t.carb });
})()
