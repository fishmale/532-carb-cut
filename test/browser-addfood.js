(async function () {
  var ids = ['rice', 'chicken', 'milk'];
  for (var i = 0; i < ids.length; i++) {
    var chip = document.querySelector('[data-act="open-food"][data-food="' + ids[i] + '"]');
    if (!chip) return 'no chip ' + ids[i];
    chip.click();
    await new Promise(function (r) { setTimeout(r, 200); });
    var f = document.querySelector('#sheetBody form[data-form="add-food"]');
    if (!f) return 'no form ' + ids[i];
    f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  window.scrollTo(0, 0);
  return 'added 3';
})()
