const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 初始化数据库
const db = new Database(path.join(__dirname, 'bookings.db'));

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    studio TEXT NOT NULL,
    date TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    photographer TEXT NOT NULL,
    contact TEXT NOT NULL,
    notes TEXT,
    createdAt TEXT NOT NULL
  )
`);

// 获取所有预约
app.get('/api/bookings', (req, res) => {
  try {
    const bookings = db.prepare('SELECT * FROM bookings ORDER BY date, startTime').all();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建新预约
app.post('/api/bookings', (req, res) => {
  try {
    const { id, studio, date, startTime, endTime, photographer, contact, notes } = req.body;

    if (!id || !studio || !date || !startTime || !endTime || !photographer || !contact) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    // 检查时间冲突
    const conflicts = db.prepare(`
      SELECT * FROM bookings
      WHERE studio = ?
      AND date = ?
      AND (
        (startTime < ? AND endTime > ?) OR
        (startTime < ? AND endTime > ?) OR
        (startTime >= ? AND endTime <= ?)
      )
    `).all(studio, date, endTime, startTime, endTime, startTime, startTime, endTime);

    if (conflicts.length > 0) {
      return res.status(409).json({ error: '该时间段已被预约' });
    }

    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO bookings (id, studio, date, startTime, endTime, photographer, contact, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, studio, date, startTime, endTime, photographer, contact, notes || '', createdAt);

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除预约
app.delete('/api/bookings/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM bookings WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '预约不存在' });
    }

    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
