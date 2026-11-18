(function () {
  var ins = document.querySelectorAll('#setupForm input');
  var vals = ['30', '178', '85', '75'];
  for (var i = 0; i < ins.length && i < vals.length; i++) {
    ins[i].value = vals[i];
    ins[i].dispatchEvent(new Event('input', { bubbles: true }));
  }
  document.getElementById('setupForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  window.scrollTo(0, 0);
  return 'ok';
})()
