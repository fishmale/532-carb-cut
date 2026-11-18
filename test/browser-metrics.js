(function () {
  function r(el) { return el ? el.getBoundingClientRect() : null; }
  function box(el) { var b = r(el); return b ? Math.round(b.width) + 'x' + Math.round(b.height) : null; }
  var out = {};
  out.viewport = innerWidth + 'x' + innerHeight;
  out.topbar = box(document.querySelector('.topbar'));
  out.tabbar = box(document.querySelector('.tabbar'));
  out.tab = box(document.querySelector('.tab'));
  out.card = box(document.querySelector('#main .card'));
  out.mainPad = getComputedStyle(document.querySelector('#main')).padding;
  out.pagePad = getComputedStyle(document.querySelector('#shell')).padding;
  out.safeArea = getComputedStyle(document.querySelector('.tabbar')).paddingBottom;
  var cs = getComputedStyle(document.querySelector('.tabbar'));
  out.tabbarCSS = 'height ' + cs.height + ', pb ' + cs.paddingBottom + ', backdrop ' + cs.backdropFilter;
  out.radii = ['--r-lg', '--r-xl'].map(function (k) { return k + '=' + getComputedStyle(document.documentElement).getPropertyValue(k).trim(); });
  out.fontFamilyBody = getComputedStyle(document.body).fontFamily.split(',')[0];
  var nowrapFixed = [];
  Array.prototype.forEach.call(document.querySelectorAll('button, .input-wrap, .seg-btn, .tab'), function (el) {
    var s = getComputedStyle(el);
    var h = parseFloat(s.height);
    if (!h || s.height === 'auto') return;
    if (h < 30) return;
    var t = (el.textContent || '').trim().slice(0, 12);
    if (!t) return;
    nowrapFixed.push(t + '[' + Math.round(h) + 'px/' + Math.round(parseFloat(s.fontSize)) + 'px/ws=' + s.whiteSpace + ']');
  });
  out.fixedHeightText = nowrapFixed.slice(0, 10);
  out.fixedHeightCount = nowrapFixed.length;
  return JSON.stringify(out, null, 1);
})()
