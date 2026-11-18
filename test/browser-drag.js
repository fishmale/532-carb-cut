(async function () {
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var layer = document.getElementById('sheetLayer');
  var panel = layer.querySelector('.sheet');
  var grip = layer.querySelector('.sheet-grip');
  var out = [];

  // 打开一个食物 sheet
  document.querySelector('[data-act="open-food"][data-food="rice"]').click();
  await sleep(400);
  out.push('open=' + !layer.hidden);

  function pe(type, y) {
    return new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch',
      isPrimary: true, clientX: 195, clientY: y
    });
  }

  grip.dispatchEvent(pe('pointerdown', 600));
  await sleep(20);
  grip.dispatchEvent(pe('pointermove', 660));
  await sleep(20);
  out.push('mid-transform=' + (panel.style.transform || 'none'));
  grip.dispatchEvent(pe('pointermove', 760));
  await sleep(20);
  grip.dispatchEvent(pe('pointerup', 760));
  await sleep(350);
  out.push('closed=' + layer.hidden);

  // 再开一次，测小位移不关闭
  document.querySelector('[data-act="open-food"][data-food="rice"]').click();
  await sleep(350);
  grip.dispatchEvent(pe('pointerdown', 600));
  grip.dispatchEvent(pe('pointermove', 630));
  grip.dispatchEvent(pe('pointerup', 630));
  await sleep(300);
  out.push('still-open=' + !layer.hidden + ' transform-reset=' + (panel.style.transform || 'none'));
  return out.join(' | ');
})()
