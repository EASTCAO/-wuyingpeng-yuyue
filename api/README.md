# 无影棚预约系统 - 后端 API

基于 Node.js + Express + SQLite 的后端服务，用于多用户数据同步。

## 功能

- 预约数据的增删查改
- 时间冲突检测
- SQLite 数据持久化
- CORS 跨域支持

## 本地开发

```bash
cd api
npm install
npm start
```

服务将在 http://localhost:3000 启动

## API 接口

### 获取所有预约
```
GET /api/bookings
```

### 创建新预约
```
POST /api/bookings
Content-Type: application/json

{
  "id": "唯一ID",
  "studio": "无影棚1号",
  "date": "2026-01-26",
  "startTime": "09:00",
  "endTime": "12:00",
  "photographer": "摄影师姓名",
  "contact": "联系方式",
  "notes": "备注信息"
}
```

### 删除预约
```
DELETE /api/bookings/:id
```

### 健康检查
```
GET /health
```

## Zeabur 部署步骤

1. 提交代码到 Git 仓库
```bash
git add .
git commit -m "Add backend API"
git push
```

2. 在 Zeabur 创建新服务
   - 选择你的 Git 仓库
   - Zeabur 会自动检测到 `api` 目录中的 Node.js 项目
   - 或者手动指定根目录为 `api`

3. 部署完成后，复制后端域名（例如：https://your-backend.zeabur.app）

4. 更新前端配置
   - 打开 `app.js`
   - 将 `API_BASE_URL` 改为你的后端域名
   - 重新部署前端

5. 测试同步功能
   - 在不同浏览器或设备打开应用
   - 创建预约，查看是否能在其他设备看到

## 数据库

使用 SQLite 数据库，数据文件为 `bookings.db`，会自动创建在 `api` 目录下。

## 环境变量

- `PORT`: 服务端口（默认 3000）

## 注意事项

- 数据库文件需要持久化存储，确保 Zeabur 配置了持久化卷
- 建议定期备份数据库文件
