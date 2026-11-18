(function () {
  var f = window.__TS || 2;
  var els = Array.prototype.slice.call(document.querySelectorAll('#main *, .topbar *, .tabbar *'));
  var scaled = 0;
  els.forEach(function (el) {
    if (el.closest('svg')) return;
    var fs = parseFloat(getComputedStyle(el).fontSize);
    if (!fs || !el.textContent.trim()) return;
    el.style.fontSize = (fs * f) + 'px';
    scaled++;
  });
  var clipped = [];
  els.forEach(function (el) {
    if (el.closest('svg')) return;
    if (!el.textContent.trim()) return;
    var cs = getComputedStyle(el);
    if (cs.overflow === 'visible') return;
    if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) {
      clipped.push((el.className || el.tagName) + '|' + el.textContent.trim().slice(0, 12));
    }
  });
  return JSON.stringify({ factor: f, scaled: scaled, clippedCount: clipped.length, clipped: clipped.slice(0, 8), overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 });
})()
