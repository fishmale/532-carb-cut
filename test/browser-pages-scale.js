(async function () {
  var out = [];
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].click();
    await new Promise(function (r) { setTimeout(r, 350); });
    var overX = document.body.scrollWidth > window.innerWidth + 1;
    var clipped = 0;
    Array.prototype.forEach.call(document.querySelectorAll('#main *, .topbar *, .tabbar *'), function (n) {
      if (n.children.length) return;
      if (n.scrollHeight > n.clientHeight + 2 && getComputedStyle(n).overflow !== 'visible') clipped++;
    });
    out.push(tabs[i].textContent.trim() + ' overX=' + overX + ' clipped=' + clipped + ' root=' + getComputedStyle(document.documentElement).fontSize);
  }
  return out.join(' | ');
})()
