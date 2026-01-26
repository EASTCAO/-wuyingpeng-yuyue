const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 数据库连接配置
// Zeabur 会自动注入这些环境变量
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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

    // 检查时间冲突
    const conflictQuery = `
      SELECT * FROM bookings
      WHERE studio = $1
      AND date = $2
      AND (
        ("startTime" < $3 AND "endTime" > $4) OR
        ("startTime" < $5 AND "endTime" > $6) OR
        ("startTime" >= $7 AND "endTime" <= $8)
      )
    `;

    const conflicts = await pool.query(conflictQuery, [
      studio, date, endTime, startTime, endTime, startTime, startTime, endTime
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
