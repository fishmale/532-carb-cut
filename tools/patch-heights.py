"""把控件固定高度改成 min-height，并给会换行的地方加规则。逐条断言，改不到就报错。"""
import sys

path = 'assets/app.css'
src = open(path, encoding='utf-8').read()

pairs = [
    ('  gap: 6px;\n  height: 48px;', '  gap: 6px;\n  min-height: 48px;'),
    ('.input-wrap.big { height: 58px; }', '.input-wrap.big { min-height: 58px; }'),
    ('.seg-btn {\n  flex: 1;\n  height: 44px;', '.seg-btn {\n  flex: 1;\n  min-height: 44px;'),
    ('  gap: 8px;\n  height: 46px;', '  gap: 8px;\n  min-height: 46px;'),
    ('.btn.tiny { position: relative; height: 44px;', '.btn.tiny { position: relative; min-height: 44px;'),
    ('.inline-form .input-wrap { height: 44px;', '.inline-form .input-wrap { min-height: 44px;'),
    ('.inline-form .btn { height: 44px;', '.inline-form .btn { min-height: 44px;'),
    ('.select {\n  height: 44px;', '.select {\n  min-height: 44px;'),
    ('.mini-form .input-wrap { height: 44px;', '.mini-form .input-wrap { min-height: 44px;'),
    ('.mini-form .btn { height: 44px; }', '.mini-form .btn { min-height: 44px; }'),
    ('.picker input[type="search"] {\n  width: 100%;\n  height: 44px;',
     '.picker input[type="search"] {\n  width: 100%;\n  min-height: 44px;'),
    ('.grams-row .gbtn {\n  height: 38px;', '.grams-row .gbtn {\n  min-height: 38px;'),
    ('.grams-row .input-wrap { flex: 1 1 110px; height: 38px; }',
     '.grams-row .input-wrap { flex: 1 1 110px; min-height: 38px; }'),
    ('.modal-actions .btn { flex: 1; height: 44px; }',
     '.modal-actions .btn { flex: 1; min-height: 44px; }'),
    ('  height: calc(var(--tab-h) + env(safe-area-inset-bottom));',
     '  min-height: calc(var(--tab-h) + env(safe-area-inset-bottom));'),
    ('.hero-intake-text { display: flex; justify-content: space-between; gap: 10px;',
     '.hero-intake-text { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 10px;'),
    ('.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px;',
     '.card-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 10px;'),
]

for old, new in pairs:
    if old not in src:
        print('MISS:', old[:60].replace('\n', '\\n'))
        sys.exit(1)
    src = src.replace(old, new, 1)

src += """

/* ---------- 文字大小与自适应收口 ---------- */
html { font-size: 100%; }

/* 品牌名在窄屏或大字号下省略，不折行挤压周标签 */
.brand { min-width: 0; }
.brand > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 顶栏与 tab 的文字不换行，高度靠 min-height 撑开 */
.tab { padding: 4px 2px; }
.tab span { white-space: nowrap; }

/* 大字号下允许卡片内数值换行，不被裁切 */
.hero-num b { line-height: 1.02; overflow-wrap: anywhere; }
.kv b, .heat-row b, .stat-row b { overflow-wrap: anywhere; }

/* 行内选择控件：文字放大后按钮跟着长高，不压字 */
.seg { align-items: stretch; }
.seg-btn { display: inline-flex; align-items: center; justify-content: center; padding: 0 10px; }
.select { padding-top: 10px; padding-bottom: 10px; }
"""

open(path, 'w', encoding='utf-8', newline='\n').write(src)
print('patched', len(pairs), 'rules + appended block')
