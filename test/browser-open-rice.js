(function () {
  var c = document.querySelector('.chip-food[data-food="rice"]');
  if (!c) return 'no chip';
  c.click();
  return 'clicked';
})()
