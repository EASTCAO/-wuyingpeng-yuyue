# 影棚预约 API

Node.js、Express 和 PostgreSQL 实现的预约后端。除健康检查、登录和根路径外，所有 `/api` 接口都需要 Bearer Token。

## 环境变量

```text
PORT=3000
DATABASE_URL=postgresql://...
AUTH_SECRET=长度足够的随机字符串
DEFAULT_USER_PASSWORD=首次创建默认账号时使用的密码
NODE_ENV=production
```

## 本地运行

```powershell
npm install
npm start
```

## 接口

- `GET /health`：检查认证配置和数据库连接。
- `POST /api/auth/login`：登录并返回 Token。
- `GET /api/auth/me`：读取当前账号。
- `POST /api/auth/change-password`：修改当前账号密码。
- `GET /api/bookings`：读取预约。
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
