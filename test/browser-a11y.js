(function () {
  function parse(c) {
    var m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',').map(function (v) { return parseFloat(v); });
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function lum(c) {
    function ch(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  }
  function blend(fg, bg) {
    return {
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1
    };
  }
  function gradientAvg(img, base) {
    var all = String(img).match(/rgba?\([^)]+\)/g) || [];
    if (!all.length) return null;
    var layer = base || { r: 255, g: 255, b: 255, a: 1 };
    var sum = { r: 0, g: 0, b: 0 }, n = 0;
    all.forEach(function (s) {
      var c = parse(s);
      if (!c) return;
      var over = blend(c, layer);
      sum.r += over.r; sum.g += over.g; sum.b += over.b; n++;
    });
    if (!n) return null;
    return { r: sum.r / n, g: sum.g / n, b: sum.b / n, a: 1 };
  }
  function pageBg() {
    var c = parse(getComputedStyle(document.body).backgroundColor);
    if (c && c.a >= 1) return c;
    var h = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (h && h.a >= 1) return h;
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  function bgOf(el) {
    var stack = [];
    var n = el;
    while (n && n.nodeType === 1) {
      var cs = getComputedStyle(n);
      var c = parse(cs.backgroundColor);
      var opaque = c && c.a >= 1;
      if (cs.backgroundImage && cs.backgroundImage.indexOf('gradient') >= 0) {
        var base = opaque ? c : pageBg();
        var g = gradientAvg(cs.backgroundImage, base);
        if (g) return g;
      }
      if (c && c.a > 0) {
        stack.push(c);
        if (c.a >= 1) break;
      }
      n = n.parentElement;
    }
    var base2 = pageBg();
    for (var i = stack.length - 1; i >= 0; i--) base2 = blend(stack[i], base2);
    return base2;
  }
  function ratio(a, b) {
    var l1 = lum(a), l2 = lum(b);
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  var fails = [], checked = 0;
  var roots = document.querySelectorAll('#main *, .topbar *, .tabbar *, #sheetLayer *, #modalLayer *');
  Array.prototype.forEach.call(roots, function (el) {
    if (el.closest('svg')) return;
    if (el.children.length) return;
    var t = (el.textContent || '').trim();
    if (!t) return;
    var cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var fg = parse(cs.color);
    if (!fg) return;
    var bg = bgOf(el);
    var f = fg.a < 1 ? blend(fg, bg) : fg;
    var cr = ratio(f, bg);
    var fs = parseFloat(cs.fontSize) || 0;
    var bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
    var need = (fs >= 18 || (bold && fs >= 14)) ? 3 : 4.5;
    checked++;
    if (cr < need) {
      fails.push({
        t: t.slice(0, 14),
        fs: Math.round(fs),
        ratio: +cr.toFixed(2),
        need: need,
        fg: cs.color,
        bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')'
      });
    }
  });
  var targets = [];
  Array.prototype.forEach.call(document.querySelectorAll('#main button, #main a, .topbar button, .tabbar button'), function (el) {
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (r.width < 44 || r.height < 44) {
      targets.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 16) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
  });
  var sizes = {};
  Array.prototype.forEach.call(document.querySelectorAll('#main *'), function (el) {
    if (!el.textContent.trim() || el.children.length) return;
    if (el.closest('svg')) return;
    var fs = Math.round(parseFloat(getComputedStyle(el).fontSize));
    if (fs) sizes[fs] = (sizes[fs] || 0) + 1;
  });
  return JSON.stringify({
    screen: document.querySelector('.tab.is-on .tab-label, .tab.is-on span') ? document.querySelector('.tab.is-on').textContent.trim() : '?',
    checked: checked,
    failCount: fails.length,
    fails: fails.slice(0, 12),
    smallTargets: targets,
    fontSizes: sizes
  }, null, 1);
})()
