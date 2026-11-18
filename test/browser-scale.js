(function () {
  var target = window.__SCALE || '1.15';
  var btn = document.querySelector('[data-text-scale="' + target + '"]');
  if (!btn) return 'no btn for ' + target;
  btn.click();
  var root = getComputedStyle(document.documentElement).fontSize;
  var overX = document.body.scrollWidth > window.innerWidth + 1;
  var clipped = 0;
  Array.prototype.forEach.call(document.querySelectorAll('#main *'), function (n) {
    if (n.children.length) return;
    if (n.scrollHeight > n.clientHeight + 2 && getComputedStyle(n).overflow !== 'visible') clipped++;
  });
  return JSON.stringify({ target: target, root: root, overX: overX, clipped: clipped });
})()
