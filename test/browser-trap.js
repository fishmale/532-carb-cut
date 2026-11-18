(function () {
  var out = [];
  var layer = document.getElementById('sheetLayer');
  var box = layer.querySelector('.sheet');
  var sel = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var list = Array.prototype.slice.call(box.querySelectorAll(sel)).filter(function (el) { return el.getClientRects().length > 0; });
  out.push('focusables=' + list.length + ' open=' + !layer.hidden);

  list[list.length - 1].focus();
  out.push('last=' + (document.activeElement === list[list.length - 1]));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  out.push('wrapped-to-first=' + (document.activeElement === list[0]));

  // Shift+Tab 从第一个回到最后一个
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  out.push('wrapped-back=' + (document.activeElement === list[list.length - 1]));

  // Escape 关闭
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  out.push('escape-closed=' + layer.hidden);
  return out.join(' | ');
})()
