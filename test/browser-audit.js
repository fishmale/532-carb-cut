(function () {
  var out = { smallTargets: [], smallTexts: [], tabbar: null, count: { buttons: 0, inputs: 0 } };
  var els = document.querySelectorAll('button, [role="button"], input, select, a[href]');
  Array.prototype.forEach.call(els, function (el) {
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (el.tagName === 'BUTTON' || el.tagName === 'A') out.count.buttons++;
    else out.count.inputs++;
    if (r.height < 44 || r.width < 44) {
      out.smallTargets.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 18) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    var cs = getComputedStyle(el);
    var fs = parseFloat(cs.fontSize);
    if (fs && fs < 11 && el.textContent.trim()) {
      out.smallTexts.push(fs + 'px ' + el.textContent.trim().slice(0, 14));
    }
  });
  var bar = document.querySelector('.tabbar');
  if (bar) {
    var br = bar.getBoundingClientRect();
    out.tabbar = Math.round(br.height) + 'px, ' + bar.querySelectorAll('.tab').length + ' tabs';
  }
  // 字号分布
  var sizes = {};
  Array.prototype.forEach.call(document.querySelectorAll('#main *, .topbar *'), function (el) {
    if (!el.textContent.trim() || el.children.length) return;
    var fs = Math.round(parseFloat(getComputedStyle(el).fontSize));
    if (fs) sizes[fs] = (sizes[fs] || 0) + 1;
  });
  out.fontSizes = sizes;
  return JSON.stringify(out);
})()
