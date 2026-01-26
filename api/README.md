# 无影棚预约系统 - 后端 API

基于 Node.js + Express + PostgreSQL 的后端服务，用于多用户数据同步。

## 功能

- 预约数据的增删查改
- 时间冲突检测
- PostgreSQL 数据持久化
- CORS 跨域支持
- 自动创建数据表

## 本地开发

```bash
cd api
npm install

# 设置数据库连接（可选，用于本地测试）
export DATABASE_URL="postgresql://username:password@localhost:5432/dbname"

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

### 1. 准备 PostgreSQL 数据库

在 Zeabur 控制台：
- 已创建 PostgreSQL 服务（你已经完成）
- 记下数据库名称（例如：zeabur）

### 2. 部署后端服务

**方式一：通过 Zeabur 网站（推荐）**

1. 访问 https://zeabur.com
2. 进入你的项目
3. 点击 "Add Service" → "Git"
4. 选择仓库：`EASTCAO/-wuyingpeng-yuyue`
5. 配置服务：
   - Service Name: `studio-booking-api`
   - Root Directory: `api`
   - Build Command: `npm install`
   - Start Command: `npm start`
6. 点击部署

**方式二：通过 Git 自动部署**

1. 提交代码到 Git
```bash
git add .
git commit -m "Update backend to use PostgreSQL"
git push
```

2. 在 Zeabur 添加服务并选择你的仓库
3. Zeabur 会自动检测 `api` 目录中的 Node.js 项目

### 3. 连接数据库

在 Zeabur 控制台：
1. 进入后端服务的设置页面
2. 点击 "Variables" 标签
3. 添加环境变量：
   - 点击 "Connect to PostgreSQL"
   - 选择你的 PostgreSQL 服务
   - Zeabur 会自动注入 `DATABASE_URL` 环境变量

或者手动添加：
- Key: `DATABASE_URL`
- Value: `postgresql://username:password@host:port/database`

### 4. 获取后端域名

部署完成后：
1. 在服务页面找到 "Domains" 部分
2. 复制域名（例如：`https://your-api.zeabur.app`）

### 5. 配置前端

编辑项目根目录的 `app.js` 文件：
```javascript
const API_BASE_URL = 'https://your-api.zeabur.app'; // 改为你的后端域名
```

提交并推送：
```bash
git add app.js
git commit -m "Configure backend URL"
git push
```

### 6. 测试

访问后端健康检查：
```
https://your-api.zeabur.app/health
```

应该返回：
```json
{"status":"ok"}
```

## 数据库

使用 PostgreSQL 数据库，表结构会在首次启动时自动创建。

### 表结构

```sql
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  studio TEXT NOT NULL,
  date TEXT NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  photographer TEXT NOT NULL,
  contact TEXT NOT NULL,
  notes TEXT,
  createdAt TEXT NOT NULL
);
```

## 环境变量

- `PORT`: 服务端口（默认 3000）
- `DATABASE_URL`: PostgreSQL 连接字符串（Zeabur 自动注入）
- `NODE_ENV`: 环境标识（production 时启用 SSL）

## 注意事项

- Zeabur 会自动将 PostgreSQL 服务连接到后端服务
- 数据库表会在首次启动时自动创建
- 生产环境会自动启用 SSL 连接
- 建议定期备份数据库
