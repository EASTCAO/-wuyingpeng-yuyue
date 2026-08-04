# 影棚预约系统

面向摄影团队的影棚预约系统，覆盖 6F、7F 无影棚和 7F 实景棚。正式前端部署在 Vercel，预约数据与账号由 Zeabur 上的 Node.js API 和 PostgreSQL 统一管理。

## 当前功能

- 6F / 7F 楼层切换，以及无影棚 / 实景棚分类切换。
- 7 个无影棚和 11 个实景场景独立预约。
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
├── style.css                  # 基础界面样式
├── studio-layout.js           # 6F/7F 与实景棚总览布局
├── studio-layout.css          # 总览布局样式
├── assets/real-studio/        # 场景示意图
├── manifest.json              # PWA 配置
├── sw.js                      # 离线缓存
└── api/
    ├── server.js              # Express API
    ├── test.js                # API 冒烟测试
    ├── migrate.js             # 数据迁移脚本
    └── package.json
```

## 本地运行

前端本地地址会自动使用浏览器本地存储，不连接线上 API：

```powershell
python -m http.server 8080
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
node --check api/server.js
cd api
npm audit --omit=dev
npm test -- https://wuhanphotoyy.zeabur.app
```

不设置测试账号时，API 测试只执行健康检查、未登录访问保护和错误登录检查。需要执行完整的预约创建、冲突和清理测试时：

```powershell
$env:TEST_USERNAME="测试账号"
$env:TEST_PASSWORD="测试密码"
npm test -- https://wuhanphotoyy.zeabur.app
```

完整测试会创建一条带 `smoke-` 前缀的临时预约，并在结束时自动删除。

## 部署

- 前端：`https://wuyingpeng-yuyue.vercel.app`
- 后端：`https://wuhanphotoyy.zeabur.app`
- 仓库：`https://github.com/EASTCAO/-wuyingpeng-yuyue`

推送 `main` 分支后，Vercel 和 Zeabur 会自动构建部署。后端生产环境至少需要配置：

```text
DATABASE_URL=postgresql://...
AUTH_SECRET=长度足够的随机字符串
NODE_ENV=production
```

`DEFAULT_USER_PASSWORD` 仅用于首次创建默认账号，正式环境应配置后再由用户及时修改密码。
