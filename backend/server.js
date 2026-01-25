const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// 数据库连接 - Zeabur 会自动注入 DATABASE_URL 环境变量
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false  // Zeabur 内部网络不需要 SSL
});

// 中间件
app.use(cors());
app.use(express.json());

// 初始化数据库表（带重试）
async function initDatabase(retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            const client = await pool.connect();
            try {
                await client.query(`
                    CREATE TABLE IF NOT EXISTS bookings (
                        id VARCHAR(50) PRIMARY KEY,
                        studio VARCHAR(50) NOT NULL,
                        date DATE NOT NULL,
                        start_time VARCHAR(10) NOT NULL,
                        end_time VARCHAR(10) NOT NULL,
                        photographer VARCHAR(100) NOT NULL,
                        note TEXT,
                        created_at BIGINT NOT NULL
                    )
                `);
                console.log('数据库表初始化成功');
                return true;
            } finally {
                client.release();
            }
        } catch (err) {
            console.error(`数据库连接尝试 ${i + 1}/${retries} 失败:`, err.message);
            if (i < retries - 1) {
                console.log(`等待 3 秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
    console.error('数据库初始化失败，但服务器将继续运行');
    return false;
}

// API 路由

// 获取所有预约
app.get('/api/bookings', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, studio, date, start_time as "startTime", end_time as "endTime", photographer, note, created_at as "createdAt" FROM bookings ORDER BY date, start_time'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('获取预约失败:', err);
        res.status(500).json({ error: '获取预约失败' });
    }
});

// 创建预约
app.post('/api/bookings', async (req, res) => {
    const { id, studio, date, startTime, endTime, photographer, note, createdAt } = req.body;

    try {
        await pool.query(
            'INSERT INTO bookings (id, studio, date, start_time, end_time, photographer, note, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [id, studio, date, startTime, endTime, photographer, note, createdAt]
        );
        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error('创建预约失败:', err);
        res.status(500).json({ error: '创建预约失败' });
    }
});

// 更新预约
app.put('/api/bookings/:id', async (req, res) => {
    const { id } = req.params;
    const { studio, date, startTime, endTime, photographer, note } = req.body;

    try {
        const result = await pool.query(
            'UPDATE bookings SET studio = $1, date = $2, start_time = $3, end_time = $4, photographer = $5, note = $6 WHERE id = $7',
            [studio, date, startTime, endTime, photographer, note, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '预约不存在' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('更新预约失败:', err);
        res.status(500).json({ error: '更新预约失败' });
    }
});

// 删除预约
app.delete('/api/bookings/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM bookings WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '预约不存在' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('删除预约失败:', err);
        res.status(500).json({ error: '删除预约失败' });
    }
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// 根路径
app.get('/', (req, res) => {
    res.json({ message: '无影棚预约系统 API', status: 'running' });
});

// 先启动服务器，再初始化数据库
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    // 异步初始化数据库
    initDatabase();
});
