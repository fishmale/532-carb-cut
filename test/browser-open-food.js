(function () {
  var row = document.querySelector('#sheetBody [data-act="open-food"][data-food="rice"]');
  if (!row) return 'no row';
  row.click();
  var t = document.querySelector('#sheetBody .sheet-title, #sheetBody h2, #sheetBody .sheet-head-main h2');
  return 'clicked; title=' + (t ? t.textContent.trim() : '?');
})()
