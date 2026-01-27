const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// 数据库连接配置
// Zeabur 会自动注入这些环境变量
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000, // 空闲连接超时
  connectionTimeoutMillis: 2000, // 连接超时
});

// 监听连接池错误
pool.on('error', (err) => {
  console.error('数据库连接池错误:', err);
});

// 测试数据库连接并创建表
pool.connect((err, client, release) => {
  if (err) {
    console.error('数据库连接失败:', err);
    return;
  }
  console.log('数据库连接成功');

  // 创建表
  client.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      studio TEXT NOT NULL,
      date TEXT NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      photographer TEXT NOT NULL,
      contact TEXT NOT NULL,
      notes TEXT,
      "createdAt" TEXT NOT NULL
    )
  `, (err) => {
    release();
    if (err) {
      console.error('创建表失败:', err);
    } else {
      console.log('数据表已就绪');
    }
  });
});

// 获取所有预约
app.get('/api/bookings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bookings ORDER BY date, "startTime"');
    res.json(result.rows);
  } catch (error) {
    console.error('获取预约失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 创建新预约
app.post('/api/bookings', async (req, res) => {
  try {
    const { id, studio, date, startTime, endTime, photographer, contact, notes } = req.body;

    if (!id || !studio || !date || !startTime || !endTime || !photographer || !contact) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    // 验证时间格式 (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ error: '时间格式错误，应为 HH:MM' });
    }

    // 验证日期格式 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: '日期格式错误，应为 YYYY-MM-DD' });
    }

    // 验证结束时间晚于开始时间
    if (startTime >= endTime) {
      return res.status(400).json({ error: '结束时间必须晚于开始时间' });
    }

    // 检查时间冲突
    // 两个时间段冲突的条件：
    // 1. 新预约的开始时间在已有预约的时间段内
    // 2. 新预约的结束时间在已有预约的时间段内
    // 3. 新预约完全包含已有预约
    const conflictQuery = `
      SELECT * FROM bookings
      WHERE studio = $1
      AND date = $2
      AND (
        ("startTime" < $3 AND "endTime" > $3) OR
        ("startTime" < $4 AND "endTime" > $4) OR
        ("startTime" >= $3 AND "endTime" <= $4)
      )
    `;

    const conflicts = await pool.query(conflictQuery, [
      studio, date, startTime, endTime
    ]);

    if (conflicts.rows.length > 0) {
      return res.status(409).json({ error: '该时间段已被预约' });
    }

    const createdAt = new Date().toISOString();

    // 插入新预约
    const insertQuery = `
      INSERT INTO bookings (id, studio, date, "startTime", "endTime", photographer, contact, notes, "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      id, studio, date, startTime, endTime, photographer, contact, notes || '', createdAt
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('创建预约失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除预约
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM bookings WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: '预约不存在' });
    }

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除预约失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: '无影棚预约系统 API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      bookings: {
        list: 'GET /api/bookings',
        create: 'POST /api/bookings',
        delete: 'DELETE /api/bookings/:id'
      }
    }
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  pool.end(() => {
    console.log('数据库连接已关闭');
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
