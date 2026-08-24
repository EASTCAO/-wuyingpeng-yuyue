# CLAUDE.md

本文件给 Claude Code（claude.ai/code）提供本仓库的工作指引。

## 先读 README

架构、功能范围、部署地址、环境变量都在 [README.md](README.md)，不要在本文件里重复一份——两份说明一旦分叉，AI 会照着过期的那份改错方向。

一句话概括：**纯静态前端（原生 HTML/CSS/JS，无构建步骤） + Node/Express/PostgreSQL 后端**。前端在 Zeabur/Vercel，后端在 Zeabur。前端在 `localhost` / `127.0.0.1` 下会自动切到 localStorage 单机模式，不连线上 API。

## 硬性约定

1. **每次完成代码修改后提交一次 git commit。**
2. **预约规则只能改 `shared/booking-rules.js`。** 营业时段、时间换算、时段合法性、冲突判断、预约状态、日期策略全在这里，前后端共用。改完必须运行：
   ```bash
   node scripts/sync-shared.js
   ```
   `api/booking-rules.js` 是它的自动同步副本（Zeabur 后端以 `./api` 为构建根目录，require 不到仓库根目录）。忘记同步 `test/shared-rules-sync.test.js` 会直接失败。
3. **不要在 `app.js` / `api/server.js` 里 `new Intl.DateTimeFormat`。** 它是 Intl 里最贵的操作，而渲染循环每轮会调用几十次。共享模块里已经复用了实例，测试也会拦这个。
4. **改了前端静态资源，同步更新三处版本号**：`index.html` 里的 `?v=`、`sw.js` 里的 `CACHE_NAME`。带 `?v=` 的资源走 Service Worker 缓存优先，不改版本号用户拿不到新代码。
5. **线上日志用 `debugLog()` 而不是 `console.log()`**（`app.js` 顶部定义，本地预览或 `localStorage.debug='1'` 时才输出）。错误照常用 `console.error`。

## 提交前必须跑

```bash
node --check app.js
node --check studio-layout.js
node --check shared/booking-rules.js
node --check api/server.js
node --test test/*.test.js
```

需要的话再跑后端冒烟测试（见 README 的「检查与测试」）。

## 测试写法

`test/` 下有两类测试，加测试时先想清楚该写哪一类：

- **行为测试**（`booking-rules.test.js`、`auth-token.test.js`、`week-date-selector.test.js`）——直接 `require` 模块调真函数。**新增纯逻辑一律写这一类。** 依赖"现在"的函数都接受可选的 `now` 参数，用它保证结果确定，不要依赖系统时间。
- **源码约束测试**（其余文件）——用正则匹配源码文本，确认前后端接在同一份实现上、DOM 结构和无障碍属性没被改掉。它挡不住逻辑错误，只挡结构性回退。**不要用它替代行为测试。**

如果你要给一段纯逻辑加正则测试，那说明这段逻辑应该先被抽进可 require 的模块。

## 关键文件

| 文件 | 职责 |
|------|------|
| `shared/booking-rules.js` | 预约规则唯一事实来源，前后端共用 |
| `app.js` | 登录、数据加载、列表/统计视图、预约表单、提醒 |
| `studio-layout.js` | 6F/7F 楼层与实景棚总览布局、拖拽画布 |
| `api/server.js` | Express API、鉴权、冲突检测（事务 + advisory lock） |
| `api/auth-token.js` | 会话令牌签发校验，改密码后旧 token 失效 |
| `sw.js` | PWA 缓存：导航网络优先，版本化静态资源缓存优先 |

## 设计系统

- 主色 `#4C7DFF`，背景 `#F7F9FC`
- 移动端断点 768px
- 系统字体栈
