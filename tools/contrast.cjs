// 计算 WCAG 对比度：node tools/contrast.cjs
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
  ['浅色 · 正文 ink/card', '#17160F', '#FFFDF8'],
  ['浅色 · 次要 ink-2/card', '#413E34', '#FFFDF8'],
  ['浅色 · 说明 muted/card', '#6F6957', '#FFFDF8'],
  ['浅色 · 说明 muted/bg', '#6F6957', '#F2EFE6'],
  ['浅色 · 绿色字 green-ink/card', '#1E5C4B', '#FFFDF8'],
  ['浅色 · 琥珀字 amber/card', '#8F5C13', '#FFFDF8'],
  ['浅色 · 危险字 danger/card', '#A6432D', '#FFFDF8'],
  ['浅色 · 白字/green', '#FFFDF8', '#1E5C4B'],
  ['浅色 · hero 白字/渐变起 #256A56', '#F5F9EC', '#256A56'],
  ['浅色 · hero 白字/渐变终 #113B2F', '#F5F9EC', '#113B2F'],
  ['浅色 · 琥珀 pill 字#FFFDF8/#8F5C13', '#FFFDF8', '#8F5C13'],
  ['深色 · 正文 ink/card', '#F2EFE3', '#1A1D16'],
  ['深色 · 次要 ink-2/card', '#CFCAB8', '#1A1D16'],
  ['深色 · 说明 muted/card', '#918B7A', '#1A1D16'],
  ['深色 · 绿色字 green-ink/card', '#58AB8E', '#1A1D16'],
  ['深色 · 琥珀字 amber/card', '#D79A45', '#1A1D16'],
  ['深色 · 白字/green', '#F6F9EE', '#2C7A62'],
  ['深色 · 琥珀 pill 字#241704/#D79A45', '#241704', '#D79A45'],
  ['深色 · 选中分段 白/#266E5A', '#F6F9EE', '#266E5A'],
  ['深色 · 图表线 #2C7A62 / bg', '#2C7A62', '#11130E'],
];
for (const [name, fg, bg] of pairs) {
  const r = ratio(fg, bg);
  const tag = r >= 4.5 ? 'AA' : r >= 3 ? 'AA-large/图形' : 'FAIL';
  console.log(`${name.padEnd(30)} ${fg} on ${bg}  ${r.toFixed(2)}:1  ${tag}`);
}
