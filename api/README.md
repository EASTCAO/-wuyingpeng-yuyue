# 影棚预约 API

Node.js、Express 和 PostgreSQL 实现的预约后端。除健康检查、登录和根路径外，所有 `/api` 接口都需要 Bearer Token。

预约规则（营业时段、15 分钟粒度、时间冲突、日期策略）来自 `booking-rules.js`——它是仓库根目录
`shared/booking-rules.js` 的自动同步副本，前后端共用同一份实现。**不要直接改 `api/booking-rules.js`**，
改根目录那份然后运行 `node scripts/sync-shared.js`。

## 环境变量

必填（`NODE_ENV=production` 下缺失会直接启动失败）：

```text
DATABASE_URL=postgresql://...
AUTH_SECRET=32 位以上的随机字符串，必须独立于 DATABASE_URL
NODE_ENV=production
```

可选：

```text
PORT=3000
ALLOWED_ORIGINS=https://photowhyy.zeabur.app,https://wuyingpeng-yuyue.vercel.app
DEFAULT_USER_PASSWORD=首次创建默认账号时使用的密码
```

未配置 `DEFAULT_USER_PASSWORD` 时跳过默认账号初始化，管理员新增用户会随机生成初始密码并返回一次。

## 安全约束

- 会话令牌带密码指纹，改密码后旧令牌立即失效（`auth-token.js`，单元测试见 `../test/auth-token.test.js`）。
- 登录限流 10 次 / 10 分钟，写接口限流 60 次 / 分钟。
- CORS 只放行 `ALLOWED_ORIGINS` 里的来源。

## 本地运行

```powershell
npm install
npm start
```

## 接口

- `GET /health`：检查认证配置和数据库连接。
- `POST /api/auth/login`：登录并返回 Token。
- `GET /api/auth/me`：读取当前账号。
- `POST /api/auth/change-password`：修改当前账号密码，返回新的 Token。
- `GET /api/bookings`：读取预约。不带参数时返回昨天到后天；`?from=&to=` 指定范围；`?all=1` 读取全量历史。
- `POST /api/bookings`：创建预约。
- `PUT /api/bookings/:id`：修改本人预约。
- `DELETE /api/bookings/:id`：取消本人预约。
- `GET /api/users`：管理员读取用户。
- `POST /api/users`：管理员添加用户。
- `DELETE /api/users/:username`：管理员删除用户。

请求头示例：

```text
Authorization: Bearer <token>
Content-Type: application/json
```

创建预约示例：

```json
{
  "id": "唯一预约编号",
  "studio": "洗衣房景别",
  "date": "2026-08-05",
  "startTime": "14:00",
  "endTime": "15:00",
  "notes": ""
}
```

服务端以登录账号作为摄影师身份，并校验棚位、日期、营业时段、15 分钟粒度、冻结状态和时间冲突。

## 测试

```powershell
npm test -- https://wuhanphotoyy.zeabur.app
```

完整增删改测试需要设置 `TEST_USERNAME` 和 `TEST_PASSWORD`，测试预约会自动清理。
