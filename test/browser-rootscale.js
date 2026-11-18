(function () {
  var pct = window.__PCT || 200;
  document.documentElement.style.fontSize = pct + '%';
  var overX = document.body.scrollWidth > window.innerWidth + 1;
  var clipped = 0;
  var worst = '';
  Array.prototype.forEach.call(document.querySelectorAll('#main *, .topbar *, .tabbar *'), function (n) {
    if (n.children.length) return;
    if (n.scrollHeight > n.clientHeight + 2 && getComputedStyle(n).overflow !== 'visible') { clipped++; worst = (n.textContent || '').slice(0, 24); }
  });
  return JSON.stringify({ pct: pct, root: getComputedStyle(document.documentElement).fontSize, overX: overX, clipped: clipped, sample: worst });
})()
