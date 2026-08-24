# 影棚预约系统

面向摄影团队的影棚预约系统，覆盖 6F、7F 无影棚和 6F、7F 实景棚。正式前端部署在 Vercel，预约数据与账号由 Zeabur 上的 Node.js API 和 PostgreSQL 统一管理。

## 当前功能

- 6F / 7F 楼层切换，以及无影棚 / 实景棚分类切换。
- 7 个无影棚和 27 个实景场景独立预约。
- 预约范围仅限今天和明天。
- 营业时间为上午 08:30-12:30、下午 14:00-18:30，间隔 15 分钟。
- 同一场景自动阻止重叠预约，不同场景可以同时预约。
- 摄影师可以修改或取消自己的预约，管理员可以管理全部预约和用户。
- 管理员可以查看昨天的预约记录。
- 小无影棚 1、2 当前处于冻结状态。
- 洗衣房景别支持鼠标悬停查看场景示意图。

## 项目结构

```text
.
├── index.html                 # 正式页面
├── app.js                     # 预约、登录和数据逻辑
├── shared/booking-rules.js    # 前后端共用的预约规则（唯一事实来源）
├── style.css                  # 基础界面样式
├── studio-layout.js           # 6F/7F 与实景棚总览布局
├── studio-layout.css          # 总览布局样式
├── assets/real-studio/        # 场景示意图
├── manifest.json              # PWA 配置
├── sw.js                      # 离线缓存
├── serve.json                 # 静态站压缩与缓存头
├── scripts/sync-shared.js     # 把 shared/ 同步到 api/
├── test/                      # 单元测试（node --test）
└── api/
    ├── server.js              # Express API
    ├── auth-token.js          # 会话令牌签发与校验
    ├── booking-rules.js       # shared/booking-rules.js 的自动同步副本，勿手改
    ├── test.js                # API 冒烟测试
    ├── migrate.js             # 数据迁移脚本
    └── package.json
```

预约规则（营业时段、15 分钟粒度、时间冲突、日期策略、预约状态）只有 `shared/booking-rules.js` 一份，
前端用 `<script>` 加载，后端用 `require` 加载。修改后必须同步：

```powershell
node scripts/sync-shared.js
```

后端在 Zeabur 上以 `./api` 为构建根目录，`require` 不到仓库根目录，所以 `api/booking-rules.js` 是
自动生成的副本。忘记同步时 `test/shared-rules-sync.test.js` 会直接失败。

## 本地运行

前端本地地址会自动使用浏览器本地存储，不连接线上 API：

```powershell
npx --yes serve -s . -l 8080
```

打开 `http://127.0.0.1:8080/index.html`。

后端需要 PostgreSQL：

```powershell
cd api
npm install
$env:DATABASE_URL="postgresql://user:password@host:5432/database"
$env:AUTH_SECRET="replace-with-a-long-random-secret"
npm start
```

## 检查与测试

```powershell
node --check app.js
node --check studio-layout.js
node --check shared/booking-rules.js
node --check api/server.js
node --test test/*.test.js
cd api
npm audit --omit=dev
npm test -- https://wuhanphotoyy.zeabur.app
```

`test/` 下分两类测试：`booking-rules.test.js`、`auth-token.test.js`、`week-date-selector.test.js`
直接调用真函数验证行为（依赖时间的函数都接受显式的 `now` 参数，结果确定）；
其余文件用正则匹配源码，确认前后端接在同一份实现上、DOM 结构和无障碍属性没有回退。

不设置测试账号时，API 测试只执行健康检查、未登录访问保护和错误登录检查。需要执行完整的预约创建、冲突和清理测试时：

```powershell
$env:TEST_USERNAME="测试账号"
$env:TEST_PASSWORD="测试密码"
npm test -- https://wuhanphotoyy.zeabur.app
```

完整测试会创建一条带 `smoke-` 前缀的临时预约，并在结束时自动删除。

## 部署

- 前端：`https://photowhyy.zeabur.app`
- Vercel 镜像：`https://wuyingpeng-yuyue.vercel.app`
- 后端：`https://wuhanphotoyy.zeabur.app`
- 仓库：`https://github.com/EASTCAO/-wuyingpeng-yuyue`

推送 `main` 分支后，Vercel 和 Zeabur 会自动构建部署。

前端静态站用 `serve` 托管（`zbpack.json`），`serve.json` 负责开启 brotli 压缩并给带版本号的
JS/CSS/图片设置一年期不可变缓存，`index.html` 和 `sw.js` 保持 `no-cache`。
未压缩的前端资源约 283KB，压缩后约 45KB。

后端生产环境必须配置：

```text
DATABASE_URL=postgresql://...
AUTH_SECRET=32 位以上的随机字符串（必须独立于 DATABASE_URL）
NODE_ENV=production
```

`NODE_ENV=production` 下缺少 `AUTH_SECRET`、长度不足 16 位、或与 `DATABASE_URL` 相同时，
服务会直接启动失败而不是带病运行（以前会静默回退到 `DATABASE_URL`）。

可选配置：

```text
ALLOWED_ORIGINS=https://photowhyy.zeabur.app,https://wuyingpeng-yuyue.vercel.app
DEFAULT_USER_PASSWORD=首次创建默认账号时使用的密码
```

`ALLOWED_ORIGINS` 不配时使用上面两个正式域名，其他来源的跨域请求不会拿到 CORS 放行头。
`DEFAULT_USER_PASSWORD` 不配时跳过默认账号初始化（不会再用内置的 `123456` 建号）；
此时管理员新增用户，后端会随机生成初始密码并在界面上显示一次，需转告本人并尽快修改。

## 安全说明

- 会话令牌带密码指纹，**修改密码后所有旧令牌立即失效**，当前设备会自动换用新令牌。
- 登录接口限流 10 次 / 10 分钟；所有写接口限流 60 次 / 分钟。
- `GET /api/bookings` 不带参数时只返回昨天到后天，不再返回整张表；统计视图用 `?all=1` 取全量历史。
