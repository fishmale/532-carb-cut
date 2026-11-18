"""把 assets/app.css 里的 font-size: Npx 换成 rem（1rem = 16px）。
SVG 图表内文字（.chart text / .chart .cap）保持 px：那是 viewBox 用户单位。"""
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'assets/app.css'
src = open(path, encoding='utf-8').read()


def fmt(v):
    s = ('%.4f' % v).rstrip('0').rstrip('.')
    return s


keep_re = re.compile(r'^(\s*)\.chart (text|\.cap)(.*)$', re.M)
protected = {}


def protect(m):
    key = '@@KEEP%d@@' % len(protected)
    protected[key] = m.group(0)
    return key


src = keep_re.sub(protect, src)

count = 0


def repl(m):
    global count
    count += 1
    return 'font-size:%s%srem' % (m.group(1), fmt(float(m.group(2)) / 16))


src = re.sub(r'font-size:(\s*)([0-9.]+)px', repl, src)

for k, v in protected.items():
    src = src.replace(k, v)

open(path, 'w', encoding='utf-8', newline='\n').write(src)
print('converted', count, 'font-size declarations')
left = re.findall(r'font-size:\s*[0-9.]+px', src)
print('remaining px font-size:', left)
