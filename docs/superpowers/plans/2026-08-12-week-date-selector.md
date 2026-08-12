# 每周日期选择器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将顶部的“今天 / 明天”替换为按周一至周日展示、可前后切周的单日选择器。

**Architecture:** 保留现有 `selectedDate`、`currentDateRange` 和 `getDisplayDates()` 数据流；新增纯日期计算函数生成周日期，并由一个渲染函数更新顶部日期条。点击日期后继续调用现有预约渲染流程。

**Tech Stack:** 原生 JavaScript、HTML、CSS、Node.js 内置测试运行器。

---

### Task 1: 日期逻辑测试

**Files:**
- Create: `test/week-date-selector.test.js`
- Modify: `app.js`

- [ ] 编写失败测试，验证周一为首日、连续 7 天、切周偏移 7 天以及自定义日期只返回一天。
- [ ] 运行 `node --test test/week-date-selector.test.js`，确认因日期周函数不存在而失败。
- [ ] 在 `app.js` 中实现日期字符串加减、周首日计算和周日期生成函数。
- [ ] 再次运行测试并确认通过。

### Task 2: 顶部日期条

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `style.css`

- [ ] 将原“今天 / 明天”按钮替换为日期条容器和左右切周按钮。
- [ ] 增加 `renderWeekDateSelector()`、`selectWeekDate()` 和 `shiftWeek()`，登录进入主页时渲染本周。
- [ ] 增加桌面及窄屏样式，保证 7 天按钮尺寸稳定、移动端可横向查看。
- [ ] 扩展测试验证页面结构和样式类存在。

### Task 3: 缓存与验收

**Files:**
- Modify: `index.html`
- Modify: `sw.js`

- [ ] 更新静态资源版本和 Service Worker 缓存名。
- [ ] 运行 `node --test test/*.test.js`、`node --check app.js`、`node --check studio-layout.js`、`git diff --check`。
- [ ] 在本地页面验证 7 天日期、前后切周、选择日期后影棚状态刷新及手机宽度布局。
- [ ] 提交所有实现文件，不提交未跟踪的 `AGENTS.md`。
