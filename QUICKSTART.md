# 🚀 快速部署指南

## 当前状态

✅ 代码已准备就绪并推送到 GitHub
✅ 后端已迁移到 PostgreSQL
✅ 前端已配置云端同步模式

## 下一步操作

### 1️⃣ 部署后端到 Zeabur（5分钟）

1. 访问 https://zeabur.com
2. 进入你的项目（已有 PostgreSQL）
3. 点击 "Add Service" → "Git"
4. 选择 `EASTCAO/-wuyingpeng-yuyue`
5. 设置根目录为 `api`
6. 连接 PostgreSQL 数据库
7. 等待部署完成
8. **复制后端域名**

### 2️⃣ 配置前端（2分钟）

```bash
# 1. 编辑 app.js
# 将第 16 行改为你的后端域名
const API_BASE_URL = 'https://你的后端域名.zeabur.app';

# 2. 提交并推送
git add app.js
git commit -m "Configure production backend URL"
git push
```

### 3️⃣ 测试（3分钟）

```bash
# 测试后端
curl https://你的后端域名.zeabur.app/health

# 或使用测试脚本
cd api
node test.js https://你的后端域名.zeabur.app
```

打开两个浏览器窗口测试多用户同步。

## 📝 详细文档

- 完整部署步骤: 查看 `DEPLOYMENT.md`
- API 文档: 查看 `api/README.md`
- 项目说明: 查看 `README.md`

## ✅ 成功标志

- 后端返回 `{"status":"ok"}`
- 前端可以创建预约
- 多个窗口数据同步
- 刷新后数据仍存在

就这么简单！🎉
