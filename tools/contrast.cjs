// 计算 WCAG 对比度：node contrast.cjs
function lumHex(hex) {
  const h = hex.replace('#', '');
  const rgb = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255);
  const lin = rgb.map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function ratio(fg, bg) {
  const a = lumHex(fg), b = lumHex(bg);
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}
const pairs = [
  ['浅色 · muted/card', '#837D6D', '#FFFDF8'],
  ['浅色 · muted/bg', '#837D6D', '#F2EFE6'],
  ['浅色 · muted/card-2', '#837D6D', '#F7F2E6'],
  ['浅色 · ink-2/card', '#413E34', '#FFFDF8'],
  ['浅色 · ink/card', '#17160F', '#FFFDF8'],
  ['浅色 · green/card', '#1E5C4B', '#FFFDF8'],
  ['浅色 · green/bg', '#1E5C4B', '#F2EFE6'],
  ['浅色 · amber/card', '#B8791F', '#FFFDF8'],
  ['浅色 · danger/card', '#A6432D', '#FFFDF8'],
  ['浅色 · white/green', '#FFFFFF', '#1E5C4B'],
  ['浅色 · lime/green', '#CFE86A', '#1E5C4B'],
  ['深色 · muted/card', '#918B7A', '#1A1D16'],
  ['深色 · muted/bg', '#918B7A', '#11130E'],
  ['深色 · ink/card', '#F2EFE3', '#1A1D16'],
  ['深色 · ink-2/card', '#CFCAB8', '#1A1D16'],
  ['深色 · green/card', '#2F8068', '#1A1D16'],
  ['深色 · lime/card', '#CFE86A', '#1A1D16'],
  ['深色 · amber/card', '#D79A45', '#1A1D16'],
  ['深色 · danger/card', '#D46A50', '#1A1D16'],
];
for (const [name, fg, bg] of pairs) {
  const r = ratio(fg, bg);
  const tag = r >= 4.5 ? 'AA' : r >= 3 ? 'AA-large' : 'FAIL';
  console.log(`${name.padEnd(22)} ${fg} on ${bg}  ${r.toFixed(2)}:1  ${tag}`);
}
