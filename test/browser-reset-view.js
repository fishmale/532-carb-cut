(function () {
  var b = document.querySelector('[data-text-scale="1"]');
  if (b) b.click();
  var s = document.querySelector('select[data-set=theme]');
  if (s) { s.value = 'light'; s.dispatchEvent(new Event('change', { bubbles: true })); }
  return JSON.stringify({ root: getComputedStyle(document.documentElement).fontSize, theme: document.documentElement.getAttribute('data-theme') });
})()
