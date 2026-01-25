# Zeabur 部署教程 - 实现多用户数据同步

本教程将指导你在 Zeabur 上部署后端服务和数据库，实现多摄影师之间的预约数据同步。

## 前提条件

- 一个 Zeabur 账号（访问 https://zeabur.com 注册）
- GitHub 账号（可选，用于代码托管）

## 部署步骤

### 第一步：创建 Zeabur 项目

1. 登录 Zeabur 控制台：https://dash.zeabur.com
2. 点击 **Create Project**（创建项目）
3. 选择一个区域（推荐选择离你最近的区域）

### 第二步：部署 PostgreSQL 数据库

1. 在项目中点击 **Add Service**（添加服务）
2. 选择 **Marketplace**
3. 搜索并选择 **PostgreSQL**
4. 点击部署，等待数据库启动完成
5. 数据库会自动生成连接信息

### 第三步：部署后端 API

**方式一：直接上传代码**

1. 点击 **Add Service** → **Git**
2. 如果代码在 GitHub 上，选择对应仓库
3. 或者选择 **Upload** 直接上传 `backend` 文件夹

**方式二：使用 Zeabur CLI**

```bash
# 安装 Zeabur CLI
npm install -g zeabur

# 登录
zeabur login

# 进入 backend 目录
cd backend

# 部署
zeabur deploy
```

### 第四步：绑定数据库

1. 点击后端服务
2. 进入 **Variables**（环境变量）标签
3. Zeabur 会自动注入 `DATABASE_URL` 环境变量
4. 如果没有自动绑定，手动添加：
   - 点击 **Add Variable**
   - 选择 **Reference** → 选择 PostgreSQL 服务
   - 选择 `DATABASE_URL`

### 第五步：获取后端 URL

1. 点击后端服务
2. 进入 **Networking**（网络）标签
3. 点击 **Generate Domain**（生成域名）
4. 复制生成的 URL，例如：`https://studio-booking-api.zeabur.app`

### 第六步：配置前端

1. 打开 `无影棚预约/app.js`
2. 找到第 15 行的 `API_BASE_URL`
3. 将其修改为你的后端 URL：

```javascript
// 修改前
const API_BASE_URL = '';

// 修改后
const API_BASE_URL = 'https://studio-booking-api.zeabur.app';
```

### 第七步：部署前端

你可以选择以下任一方式部署前端：

**方式一：Zeabur 静态网站**
1. 在同一项目中添加新服务
2. 上传 `无影棚预约` 文件夹
3. Zeabur 会自动识别为静态网站

**方式二：Vercel**
1. 访问 https://vercel.com
2. 上传 `无影棚预约` 文件夹
3. 部署完成后获得访问链接

**方式三：GitHub Pages**
1. 将代码推送到 GitHub
2. 在仓库设置中启用 GitHub Pages

## 验证部署

1. 访问前端网站
2. 登录并创建一个预约
3. 用另一个浏览器或设备访问同一网站
4. 用不同的名字登录
5. 确认可以看到之前创建的预约

## 常见问题

### Q: 数据没有同步？
A: 检查以下几点：
- 确认 `API_BASE_URL` 配置正确
- 打开浏览器开发者工具（F12），查看 Console 是否有错误
- 确认后端服务正在运行

### Q: 后端报错 "数据库连接失败"？
A: 确认 PostgreSQL 服务已启动，且 `DATABASE_URL` 环境变量已正确绑定。

### Q: 如何查看后端日志？
A: 在 Zeabur 控制台点击后端服务，进入 **Logs** 标签查看。

## 费用说明

Zeabur 提供免费额度：
- 每月 $5 免费额度
- PostgreSQL 数据库包含在内
- 对于小型团队使用完全足够

## 数据迁移

如果你之前使用 localStorage 存储了数据，需要手动迁移：

1. 在旧版本中打开浏览器开发者工具
2. 在 Console 中执行：`console.log(localStorage.getItem('bookings'))`
3. 复制输出的 JSON 数据
4. 使用数据库管理工具导入到 PostgreSQL

---

部署完成后，所有摄影师都可以看到彼此的预约，实现真正的团队协作！
