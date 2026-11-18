# Design review: 532 碳降（移动网页 / PWA）

> 依据：apple-design skill 的 HIG 资料（`references/hig/*.md`）+ 实测数据。
> 测量环境：390×844 视口、`http://127.0.0.1:5320/`，数据为 4 周历史（28 条体重、2 次调碳、1 条待调碳）。
> 数值来自浏览器实际计算样式与 `tools/contrast.cjs`，不是估计。

## Summary

这是一套「克制到只剩数字」的记录工具：暖纸底、深绿主色、荧光绿强调，唯一的主角是今日热量和三条宏量条。整体评级 **Good**——没有 Critical 问题，本轮把 4 个 High（对比度、触控尺寸、选择器、暗色强调色）全部修掉后，剩下的都是 Low 级打磨项。它被记住的应该是「今日摄入目标 + 已摄入/还可吃」那一块 hero：把 532 方法里最需要一眼看清的两个数放在同一屏顶部。

## Critical

无。原有一处接近 Critical 的隐患已修：浅色 `--muted` 只有 4.04:1（卡片）／3.57:1（页面底色），用于 11–12.5 px 的说明文字，低于 WCAG AA 对小字的 4.5:1。

> `accessibility.md › Best practices`: "Strive to meet color contrast minimum standards."
> `accessibility.md › Best practices`: 「Up to 17 pts → 4.5:1」

## Improvements

### 1. 对比度（High，已修）

| 位置 | 修前 | 修后 |
| --- | --- | --- |
| 浅色次要文字 `--muted` | #837D6D → 4.04:1（卡片）/ 3.57:1（页面） | #6F6957 → 5.39:1 / 4.76:1 |
| 浅色琥珀 `--amber`（未达标、脂肪） | #B8791F → 3.57:1 | #8F5C13 → 5.57:1 / 4.93:1 |
| 深色绿色文字（链接、达标、补记） | #2F8068 → 3.58:1 | 新 token `--green-ink` #58AB8E → 6.20:1 |

按钮内的白字未动：白 / #1E5C4B = 7.81:1，白 / 深色 #2F8068 = 4.76:1，都达标。

### 2. 触控目标（High，已修）

`accessibility.md`：iOS 最小 **44×44 pt**。实测三处不达标：

- 记录（今日页晨重行）= 51×32 → `.btn.tiny` 高度改为 44 px；
- 全部食物 21 种 = 82×19 → `.link` 加 `::after` 命中区（上下各扩 13 px，实际命中 45 px 高）；
- 找不到？自定义一份 = 113×19 → 同上。

其余按钮、tab、食物行、选择器行均 ≥44（tab 条 62 px，食物行 48 px，选择器行 48 px）。

### 3. 快速添加不该让人翻 21 个（High，已修）

原来 21 个食物 chip 横向滚动，找到目标平均要滑 2–3 屏。现在按「最近常吃」排序取前 6（`recentFoods()` 统计 `foodId` 的次数与最近日期），头部给「全部食物 21 种」进入选择器：搜索框 + 「最近常吃」+ 按主食/蛋白/水果/乳制品/坚果油脂分组，行高 48 px，右侧显示碳水 g/100 g。

> `search-fields.md`: "A search field lets people search a collection of content for specific terms they enter."

### 4. Sheet 的关闭方式（Medium，已修）

- 抓手（grip）原来只有 38×4 px，现在是用伪元素包出的 44 px 高命中区，向下拖 >96 px 关闭，小位移回弹；
- 增加 Tab 焦点陷阱（正向/反向都在 sheet 内循环）与 Esc 关闭；
- 关闭后焦点回到触发元素（`rememberFocus/restoreFocus`）。

> `sheets.md › Best practices`: "Provide an alternative to the Done button."（我们始终有 ✕ 与点遮罩关闭）

### 5. 字号下限（Medium，已修）

全站最小字号由 9–10 px 提到 **11 px**（图表刻度 11、快捷 chip 说明 11、hero 单位 11）。

> `typography.md › Specifications`: 「iOS, iPadOS | default 17 pt | minimum 11 pt」

### 6. 列表行的可点提示（Medium，已修）

「每日记录」每行都能点开改日期，但原来没有任何提示。现在行尾加了 `›`。

> `lists-and-tables.md › Best practices`: "If you need to let people drill into a list or table row's subviews, use a disclosure indicator accessory control."

### 7. 仍然存在的 Low

- **没有 Dynamic Type 等价物**：字号全部是 px，系统「文字大小」不会生效；浏览器缩放可用，但 iOS 的辅助功能字号不跟随（`accessibility.md` 建议至少支持 200%）。网页端受限于「px 字号 + 无 iOS 系统字号 API」，要真正等价，得把排版改成 rem 并加一个「文字大小」设置（小程序版天然可用 `rpx`）。
- **没有触觉反馈**：`navigator.vibrate` 只在 Android Chrome 生效，iOS Safari 完全不实现，网页无法触发 Taptic Engine；保存成功目前只靠 toast。上小程序后可用 `wx.vibrateShort` 补。
- **删除食物没有撤销**：直接删除，靠的是「一眼能看到它消失」。加一个 3 秒 Undo 会更接近系统级体验。

> 图表刻度已在本轮修掉：两张 SVG 的 `viewBox` 宽度改为容器实际像素宽（`syncChartWidth()`，绘制后测量再重绘一次），`340 → 324` 的缩放消失，刻度与「272 g」等标注真正落在 11 px；`.chart .cap` 也从 9.5 px 提到 11 px。

## Craft notes

- **视觉论点**：把「碳脂蛋」当成三条体温计，hero 用大号等宽数字撑场面，其余一律压低对比度让位。这一点做得很稳：整页只有 hero 是饱和绿，卡片全是暖白，荧光绿只出现在进度与关键数字上。
- **文字**：数字用等宽（`--mono`），中文用系统黑体，单位统一小一号并降一档对比度——是 iOS「正文 + 脚注」的做法，不是网页式的字号堆叠。
- **节奏**：卡片圆角 20 px、内边距 16–18 px、卡片间距 12 px，纵向呼吸一致；hero 20 px 圆角 + 渐变，是唯一的重心。
- **一句话**：它不像模板套出来的减脂 App，像一张被认真排版过的记录卡。

## What works

- **hero 的三层信息**：目标热量 → 进度条 → 「已摄入 / 还可吃」，扫一眼就知道今天还能吃多少；这是本轮从用户反馈里长出来的，保留。
- **532 堆叠条**：一条横条同时表达比例和克数，色块顺序与下方图例一致，颜色带语义（碳水=荧光绿、蛋白=深绿、脂肪=琥珀）。
- **规则卡把方法本身写在产品里**：5 条规则 + 当前周目标，不需要外部教程。
- **空状态**：空曲线、空记录、空结算都有具体下一步（「记录 2 天以上就能看到曲线」「点补记」），不是一句「暂无数据」。
- **已做对的无障碍**：`aria-modal`/`aria-labelledby`、toast `role="status" aria-live="polite"`、`:focus-visible` 描边、`prefers-reduced-motion`、`prefers-contrast: more`、安全区 `env(safe-area-inset-*)` 全覆盖（顶栏、tab 条、sheet 底部、toast）。

## Platform notes

- **网页 vs iPhone 原生**：tab 条 62 px + 安全区、sheet 最大 88 vh、sheet 从底部升起的动画时长 280 ms，观感接近原生；但页面滚动与 sheet 滚动是两层，iOS 上快速滑动时偶有「先滚页面」的错觉（已用 `body.no-scroll` 锁住）。
- **PWA**：iOS 需要「添加到主屏幕」才有独立窗口与离线；Android Chrome 支持 `beforeinstallprompt`，我们做了「一键安装」按钮。
- **小程序迁移时**：`core.js` 可直接复用；需要重写的是本文件里所有「视觉资产」——SVG 图表换 canvas、`:focus-visible` 换键盘焦点样式、`env(safe-area-inset-*)` 换成小程序的安全区变量。
- **不要照搬的**：网页的 hover 态（`@media (hover: hover)`）在小程序里没有意义。

---

_本评审用于自查设计质量，不代表 Apple 官方意见。_
