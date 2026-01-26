# 无影棚预约系统

一个轻量级的影棚预约管理系统，支持多影棚、多用户的预约管理。

## 功能特点

- 📅 **多影棚管理**：支持4个影棚（2个大棚 + 2个小棚）
- 👥 **多用户支持**：每个用户独立登录，查看自己的预约
- 🔄 **云端同步**：支持后端 API，实现多用户实时数据同步
- 📊 **多视图展示**：列表视图和时间轴视图
- 💾 **双模式存储**：支持本地 localStorage 或云端数据库
- 📱 **PWA 支持**：支持离线使用和桌面安装
- 🔔 **预约提醒**：自动提醒即将开始的预约

## 技术栈

**前端**
- 纯前端实现：HTML + CSS + JavaScript
- 无需构建工具，开箱即用
- PWA 技术支持离线访问
- 响应式设计，支持移动端

**后端**
- Node.js + Express
- PostgreSQL 数据库
- RESTful API
- CORS 跨域支持

## 项目结构

```
.
├── index.html          # 主页面
├── app.js             # 业务逻辑
├── style.css          # 样式文件
├── sw.js              # Service Worker
├── manifest.json      # PWA 配置
├── api/               # 后端 API
│   ├── server.js      # Express 服务器
│   ├── migrate.js     # 数据库迁移脚本
│   ├── test.js        # API 测试脚本
│   ├── package.json   # 依赖配置
│   └── zbpack.json    # Zeabur 构建配置
├── CLAUDE.md          # Claude Code 项目指导
└── README.md          # 项目说明
```

## 本地运行

### 前端

```bash
# 使用 Python 启动本地服务器
python -m http.server 8000

# 或使用 Node.js
npx http-server -p 8000

# 访问 http://localhost:8000
```

### 后端（可选）

```bash
cd api
npm install
npm start

# 后端运行在 http://localhost:3000
```

## 部署

### 前端部署

**Vercel / Netlify / GitHub Pages**
- 直接上传项目根目录
- 无需构建步骤

### 后端部署到 Zeabur

1. **创建 PostgreSQL 服务**
   - 在 Zeabur 控制台创建 PostgreSQL 服务

2. **部署后端服务**
   - 连接 GitHub 仓库
   - 设置根目录为 `api`
   - 配置环境变量：
     ```
     DATABASE_URL=postgresql://user:password@host:port/database
     NODE_ENV=development
     PORT=${WEB_PORT}
     ```

3. **更新前端配置**
   - 修改 `app.js` 中的 `API_BASE_URL` 为后端地址
   - 重新部署前端

详细部署指南请查看 `zeabur-env-config-guide.html`

## API 文档

### 端点

- `GET /health` - 健康检查
- `GET /api/bookings` - 获取所有预约
- `POST /api/bookings` - 创建新预约
- `DELETE /api/bookings/:id` - 删除预约

### 测试

```bash
cd api
node test.js https://your-backend-url.zeabur.app
```

## 开发

### 数据库迁移

如果需要重建数据库表结构：

```bash
cd api
node migrate.js "postgresql://connection-string"
```

## License

MIT
python -m http.server 8000

# 或使用 Node.js
npx serve

# 然后访问 http://localhost:8000
```

## 部署

### 模式选择

**单机模式（仅本地存储）**
- 使用 localStorage 存储数据
- 无需后端，部署简单
- 每个用户的数据独立，无法互相看到其他人的预约
- 适合个人使用或单设备使用

**云端模式（多用户同步）**
- 使用后端 API + 数据库
- 多用户实时数据同步
- 所有用户看到相同的预约信息
- 适合团队协作使用

### 部署到 Zeabur

#### 1. 部署前端（必需）

```bash
# 提交代码
git add .
git commit -m "Deploy frontend"
git push

# 在 Zeabur 创建新服务
# 选择你的 Git 仓库
# Zeabur 会自动识别为静态网站
```

前端部署完成后，你会得到一个域名，例如：`https://your-app.zeabur.app`

#### 2. 部署后端（可选，用于多用户同步）

```bash
# 在 Zeabur 创建另一个服务
# 选择同一个 Git 仓库
# 设置根目录为 'api' 或让 Zeabur 自动检测
```

后端部署完成后，你会得到另一个域名，例如：`https://your-api.zeabur.app`

#### 3. 配置云端同步

编辑 `app.js` 文件，将后端域名填入：

```javascript
const API_BASE_URL = 'https://your-api.zeabur.app'; // 改为你的后端域名
```

然后重新提交并部署前端：

```bash
git add app.js
git commit -m "Configure backend URL"
git push
```

#### 4. 测试同步功能

- 在不同浏览器或设备打开应用
- 创建预约，查看是否能在其他设备实时看到
- 删除预约，查看是否能在其他设备同步删除

### 其他部署平台

项目也可以部署到：
- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages

**注意**：如果使用其他平台部署后端，需要单独部署 Node.js 应用（api 目录）。

## 使用说明

1. **登录**：输入用户名和密码（支持记住密码）
2. **查看预约**：切换列表视图或时间轴视图
3. **新建预约**：选择影棚、日期、时间段
4. **管理预约**：查看、删除自己的预约

## 影棚配置

- **大棚**：无影棚1号、无影棚2号
- **小棚**：无影棚3号、无影棚4号
- **营业时间**：9:00 - 18:00

## 许可证

MIT License
