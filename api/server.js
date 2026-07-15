const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.DATABASE_URL;
const DEFAULT_USER_PASSWORD = process.env.DEFAULT_USER_PASSWORD || '123456';
const BOOKABLE_PERIODS = [
  { start: '08:30', end: '12:30' },
  { start: '14:00', end: '18:30' }
];
const STUDIO_IDS = [
  '大无影棚1（工位对面）',
  '大无影棚2（鄢军隔壁）',
  '小无影棚1',
  '小无影棚2',
  '小无影棚3',
  '小无影棚4',
  '6F无影棚'
];
const DEFAULT_USER_NAMES = [
  '周旭欣', '曹东', '曹玉', '程维跃', '付国俊', '何雨涵', '李冬梅', '卢圣林',
  '吕书悦', '阮静', '沈磊', '涂萱', '王斐雯', '王思琪', '王羽', '魏钰涵',
  '於佳莹', '夏驰', '向芷琪', '杨丽', '鄢军', '张阳洋', '刘欣悦', '吕文祎',
  '叶雨婷', '程思盈', '魏伟', '谭金林', '徐优', 'admin'
];

// 中间件
app.use(cors());
app.use(express.json());

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expected] = String(storedHash || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

function signToken(user) {
  if (!AUTH_SECRET) throw new Error('AUTH_SECRET is not configured');
  const payload = Buffer.from(JSON.stringify({
    username: user.username,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readToken(token) {
  if (!AUTH_SECRET || !token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed.exp > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || '';
  const user = readToken(authorization.startsWith('Bearer ') ? authorization.slice(7) : '');
  if (!user) return res.status(401).json({ error: '请先登录' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '没有管理员权限' });
  next();
}

function minutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function getChinaDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function isValidBookingDate(date) {
  return date === getChinaDate() || date === getChinaDate(1);
}

function isEditableBooking(booking) {
  if (booking.date === getChinaDate(1)) return true;
  return booking.date === getChinaDate() && booking.endTime > new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date());
}

function isValidBookingRange(startTime, endTime) {
  if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(startTime)
    || !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) return false;
  return BOOKABLE_PERIODS.some(period =>
    startTime >= period.start && endTime <= period.end && minutes(startTime) < minutes(endTime)
    && (minutes(startTime) - minutes(period.start)) % 15 === 0
    && (minutes(endTime) - minutes(period.start)) % 15 === 0
  );
}

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

async function ensureDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
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
    `);

    const studioMigrations = [
      ['无影棚1号', '大无影棚1（工位对面）'],
      ['无影棚2号', '大无影棚2（鄢军隔壁）'],
      ['无影棚3号', '小无影棚1'],
      ['无影棚4号', '小无影棚2'],
      ['5楼无影棚', '小无影棚2'],
      ['6楼无影棚', '6F无影棚']
    ];
    for (const [legacyStudio, studio] of studioMigrations) {
      await client.query('UPDATE bookings SET studio = $1 WHERE studio = $2', [studio, legacyStudio]);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        "passwordHash" TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'photographer',
        "createdAt" TEXT NOT NULL
      )
    `);

    for (const username of DEFAULT_USER_NAMES) {
      await client.query(
        `INSERT INTO users (username, "passwordHash", role, "createdAt")
         VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING`,
        [username, hashPassword(DEFAULT_USER_PASSWORD), username === 'admin' ? 'admin' : 'photographer', new Date().toISOString()]
      );
    }
  } finally {
    client.release();
  }
}

const databaseReady = ensureDatabase();
databaseReady.then(() => console.log('数据库和用户表已就绪')).catch(error => {
  console.error('数据库初始化失败:', error);
});

app.use('/api', async (req, res, next) => {
  try {
    await databaseReady;
    next();
  } catch {
    res.status(503).json({ error: '数据库暂时不可用' });
  }
});

// 登录与会话
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
    const result = await pool.query('SELECT username, "passwordHash", role FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    res.json({ token: signToken(user), user: { username: user.username, role: user.role } });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录服务暂时不可用' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: { username: req.user.username, role: req.user.role } });
});

app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT username, role, "createdAt" FROM users ORDER BY username');
    res.json(result.rows);
  } catch (error) {
    console.error('获取用户失败:', error);
    res.status(500).json({ error: '获取用户失败' });
  }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    if (!username || username.length > 20) return res.status(400).json({ error: '用户名格式不正确' });
    const password = String(req.body?.password || DEFAULT_USER_PASSWORD);
    const result = await pool.query(
      `INSERT INTO users (username, "passwordHash", role, "createdAt")
       VALUES ($1, $2, 'photographer', $3) RETURNING username, role, "createdAt"`,
      [username, hashPassword(password), new Date().toISOString()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: '用户已存在' });
    console.error('添加用户失败:', error);
    res.status(500).json({ error: '添加用户失败' });
  }
});

app.delete('/api/users/:username', requireAuth, requireAdmin, async (req, res) => {
  const username = decodeURIComponent(req.params.username);
  if (username === 'admin') return res.status(400).json({ error: '不能删除管理员' });
  const result = await pool.query('DELETE FROM users WHERE username = $1', [username]);
  if (result.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
  res.json({ message: '用户已删除' });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: '密码格式不正确' });
    }
    const result = await pool.query('SELECT "passwordHash" FROM users WHERE username = $1', [req.user.username]);
    if (!result.rows[0] || !verifyPassword(currentPassword, result.rows[0].passwordHash)) {
      return res.status(401).json({ error: '当前密码错误' });
    }
    await pool.query('UPDATE users SET "passwordHash" = $1 WHERE username = $2', [hashPassword(newPassword), req.user.username]);
    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// 获取所有预约
app.get('/api/bookings', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bookings ORDER BY date, "startTime"');
    res.json(result.rows);
  } catch (error) {
    console.error('获取预约失败:', error);
    res.status(500).json({ error: '获取预约失败' });
  }
});

// 创建新预约
app.post('/api/bookings', requireAuth, async (req, res) => {
  try {
      const { id, studio, date, startTime, endTime, notes } = req.body;

    if (!id || !studio || !date || !startTime || !endTime) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    if (!STUDIO_IDS.includes(studio)) return res.status(400).json({ error: '影棚无效' });
    if (!isValidBookingDate(date)) return res.status(400).json({ error: '只能预约今天或明天' });
    if (!isValidBookingRange(startTime, endTime)) return res.status(400).json({ error: '时间必须在营业时段内，且按15分钟预约' });

    const client = await pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${studio}:${date}`]);
      const conflictQuery = `
      SELECT * FROM bookings
      WHERE studio = $1
      AND date = $2
      AND NOT ("endTime" <= $3 OR "startTime" >= $4)
    `;

      const conflicts = await client.query(conflictQuery, [studio, date, startTime, endTime]);

      if (conflicts.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: '该时间段已被预约' });
      }

      const createdAt = new Date().toISOString();

      const insertQuery = `
      INSERT INTO bookings (id, studio, date, "startTime", "endTime", photographer, contact, notes, "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

      const result = await client.query(insertQuery, [
        id, studio, date, startTime, endTime, req.user.username, req.user.username, notes || '', createdAt
      ]);
      await client.query('COMMIT');
      transactionStarted = false;

      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('创建预约失败:', error);
    if (error.code === '23505') return res.status(409).json({ error: '预约编号已存在' });
    res.status(500).json({ error: '创建预约失败' });
  }
});

// 修改预约时间
app.put('/api/bookings/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { studio, date, startTime, endTime, notes } = req.body || {};
    if (!studio || !date || !startTime || !endTime) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    if (!STUDIO_IDS.includes(studio)) return res.status(400).json({ error: '影棚无效' });
    if (!isValidBookingDate(date)) return res.status(400).json({ error: '只能预约今天或明天' });
    if (!isValidBookingRange(startTime, endTime)) {
      return res.status(400).json({ error: '时间必须在营业时段内，且按15分钟预约' });
    }

    const existing = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: '预约不存在' });
    const booking = existing.rows[0];
    if (req.user.role !== 'admin' && booking.photographer !== req.user.username) {
      return res.status(403).json({ error: '只能修改自己的预约' });
    }
    if (!isEditableBooking(booking)) {
      return res.status(400).json({ error: '已过期预约不能修改' });
    }

    const client = await pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${studio}:${date}`]);
      const conflicts = await client.query(
        `SELECT id FROM bookings
         WHERE studio = $1 AND date = $2 AND id <> $3
         AND NOT ("endTime" <= $4 OR "startTime" >= $5)`,
        [studio, date, id, startTime, endTime]
      );
      if (conflicts.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: '该时间段已被预约' });
      }

      const result = await client.query(
        `UPDATE bookings
         SET studio = $1, date = $2, "startTime" = $3, "endTime" = $4, notes = $5
         WHERE id = $6
         RETURNING *`,
        [studio, date, startTime, endTime, notes || '', id]
      );
      await client.query('COMMIT');
      transactionStarted = false;
      res.json(result.rows[0]);
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('修改预约失败:', error);
    res.status(500).json({ error: '修改预约失败' });
  }
});

// 删除预约
app.delete('/api/bookings/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT photographer FROM bookings WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: '预约不存在' });
    const booking = existing.rows[0];
    if (req.user.role !== 'admin' && booking.photographer !== req.user.username) {
      return res.status(403).json({ error: '只能取消自己的预约' });
    }
    const result = await pool.query('DELETE FROM bookings WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: '预约不存在' });
    }

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除预约失败:', error);
    res.status(500).json({ error: '取消预约失败' });
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
        update: 'PUT /api/bookings/:id',
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
