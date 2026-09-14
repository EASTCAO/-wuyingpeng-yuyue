const express = require('express');
const cors = require('cors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { Pool } = require('pg');
const crypto = require('crypto');
const { createTokenCodec } = require('./auth-token');
// 与前端 app.js 共用同一份预约规则。booking-rules.js 由 shared/booking-rules.js
// 自动同步生成（Zeabur 只以 ./api 为构建根目录），请勿手工修改。
const {
  getChinaDate,
  isValidDateString,
  isValidBookingRange,
  isValidBookingDate,
  getBookingWindowDays,
  isBookingStartAvailable,
  isBookingEditable
} = require('./booking-rules');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const AUTH_SECRET = process.env.AUTH_SECRET;
const DEFAULT_USER_PASSWORD = process.env.DEFAULT_USER_PASSWORD;

// AUTH_SECRET 以前会静默回退到 DATABASE_URL——数据库连接串出现在构建日志、错误堆栈
// 和平台面板里的概率远高于专用密钥，一旦泄漏就能伪造任意用户（含 admin）的 token。
// 现在生产环境缺失或复用就直接启动失败，绝不带病运行。
if (IS_PRODUCTION) {
  const fatal = [];
  if (!AUTH_SECRET) fatal.push('AUTH_SECRET 未配置');
  if (AUTH_SECRET && AUTH_SECRET.length < 16) fatal.push('AUTH_SECRET 太短，至少需要 16 位');
  if (AUTH_SECRET && AUTH_SECRET === process.env.DATABASE_URL) fatal.push('AUTH_SECRET 不能复用 DATABASE_URL');
  if (fatal.length > 0) {
    console.error('启动失败，认证配置不安全：');
    fatal.forEach(message => console.error(`  - ${message}`));
    process.exit(1);
  }
  if (AUTH_SECRET.length < 32) {
    console.warn('⚠️  AUTH_SECRET 建议使用 32 位以上的随机字符串');
  }
}

// 没配 DEFAULT_USER_PASSWORD 时不再用内置的 123456 建号——那会让所有默认账号共用一个弱口令。
// 这里只跳过初始化并告警，不阻断启动：默认账号早就建好了，缺这个变量不该导致线上停机。
const CAN_SEED_DEFAULT_USERS = Boolean(DEFAULT_USER_PASSWORD) && DEFAULT_USER_PASSWORD.length >= 6;
if (!CAN_SEED_DEFAULT_USERS) {
  console.warn('⚠️  未配置 DEFAULT_USER_PASSWORD（或长度不足 6 位），已跳过默认账号初始化。');
  console.warn('   需要新建默认账号时请先配置该变量，并要求用户首次登录后立即改密码。');
}

// 允许访问 API 的前端来源。同源工具（curl、健康检查）不带 Origin，直接放行。
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS
  || 'https://photowhyy.zeabur.app,https://wuyingpeng-yuyue.vercel.app')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const STUDIO_IDS = [
  '大无影棚1（工位对面）',
  '大无影棚2（鄢军隔壁）',
  '小无影棚1',
  '小无影棚2',
  '小无影棚3',
  '小无影棚4',
  '6F无影棚',
  '小木屋景',
  '卧室景',
  '酒吧景',
  '书房景',
  '客厅景',
  '木纹台面-厨房景',
  '儿童房景/户外下午茶景',
  '工具台景',
  '洗衣房景别',
  '黑色台面-厨房景',
  '浴室景',
  '6F·走廊景',
  '6F·木墙景',
  '6F·绿植背景墙景',
  '6F·绿植房景',
  '6F·儿童房景',
  '6F·教室景',
  '6F·医护室景',
  '6F·海洋背景墙景',
  '6F·书房景',
  '6F·复古餐厅景',
  '6F·现代客厅景',
  '6F·现代餐厅景',
  '6F·街道景',
  '6F·户外咖啡景',
  '6F·卧室景',
  '6F·洗浴室景',
  '6F·吧台景',
  '6F·国风景',
  '6F·工具间景',
  '6F·现代厨房景',
  '6F·茶水间',
  '5F·阳台景'
];
const FROZEN_STUDIO_IDS = new Set(['小无影棚1', '小无影棚2']);
const SIMPLE_VIDEO_STUDIO_IDS = [
  '大无影棚1（工位对面）',
  '大无影棚2（鄢军隔壁）',
  '小无影棚1',
  '小无影棚2',
  '小无影棚3',
  '小无影棚4'
];
const DEFAULT_USER_NAMES = [
  '周旭欣', '曹东', '曹玉', '程维跃', '付国俊', '何雨涵', '李冬梅', '卢圣林',
  '吕书悦', '阮静', '沈磊', '涂萱', '王斐雯', '王思琪', '王羽', '魏钰涵',
  '於佳莹', '夏驰', '向芷琪', '杨丽', '鄢军', '张阳洋', '刘欣悦', '吕文祎',
  '叶雨婷', '程思盈', '魏伟', '谭金林', '徐优',
  '陈梦轲', '陈思', '樊瑾怡', '李梦涵', '向纯希', '夏姝敏', '周梓君', 'admin'
];
const SIMPLE_VIDEO_ASSIGNMENTS = {
  '曹东': '涂萱',
  '於佳莹': '向芷琪',
  '夏驰': '李冬梅',
  '谭金林': '何雨涵',
  '杨丽': '魏钰涵',
  '卢圣林': '王羽',
  '鄢军': '曹玉',
  '吕文祎': '王思琪',
  '徐优': '程思盈',
  '周旭欣': '魏钰涵',
  '付国俊': '阮静',
  '沈磊': '王斐雯',
  '张阳洋': '魏钰涵'
};
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: '登录尝试过于频繁，请稍后再试' }
});

// 写接口同样需要限流：登录限流挡不住已经拿到 token 的账号刷接口。
// 60 次/分钟远高于正常操作频率（一次预约最多 2 个写请求），只挡住脚本级滥用。
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: req => req.user?.username || ipKeyGenerator(req.ip),
  message: { error: '操作过于频繁，请稍后再试' }
});

// 中间件
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // 返回 false 而不是抛错：跨域被拒时浏览器本来就会拦下响应，
    // 抛错只会让服务端多出一堆 500 日志。
    callback(null, false);
  }
}));
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
});

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

// token 的签发与校验见 auth-token.js（单元测试：test/auth-token.test.js）。
const tokenCodec = AUTH_SECRET ? createTokenCodec(AUTH_SECRET) : null;

function signToken(user) {
  if (!tokenCodec) throw new Error('AUTH_SECRET is not configured');
  return tokenCodec.sign(user);
}

function readToken(token) {
  return tokenCodec ? tokenCodec.read(token) : null;
}

async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || '';
  const tokenUser = readToken(authorization.startsWith('Bearer ') ? authorization.slice(7) : '');
  if (!tokenUser) return res.status(401).json({ error: '请先登录' });

  try {
    const result = await pool.query('SELECT username, role, "passwordHash" FROM users WHERE username = $1', [tokenUser.username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: '登录已失效，请重新登录' });
    if (!tokenCodec.matchesUser(tokenUser, user)) {
      return res.status(401).json({ error: '密码已修改，请重新登录' });
    }
    req.user = { username: user.username, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '没有管理员权限' });
  next();
}

async function isAuthorizedSimpleVideoBooking(user, taskId, date, studio) {
  if (!taskId || date !== getChinaDate(2) || !SIMPLE_VIDEO_STUDIO_IDS.includes(studio)) return false;
  const result = await pool.query(
    'SELECT photographer, date, "needsSimpleVideo" FROM bookings WHERE id = $1',
    [taskId]
  );
  const task = result.rows[0];
  return Boolean(task?.needsSimpleVideo)
    && task.date === getChinaDate(1)
    && SIMPLE_VIDEO_ASSIGNMENTS[task.photographer] === user.username;
}

// 错误文案要跟着棚位的实际窗口走，不能再一律写"只能预约今天或明天"。
function describeBookingWindow(studio) {
  const days = getBookingWindowDays(studio);
  return days > 2 ? `该影棚只能预约未来 ${days} 天内的日期` : '只能预约今天或明天';
}

function isEditableBooking(booking) {
  return isBookingEditable(booking);
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
        "needsSimpleVideo" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TEXT NOT NULL
      )
    `);
    await client.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "needsSimpleVideo" BOOLEAN NOT NULL DEFAULT FALSE');
    await client.query('CREATE INDEX IF NOT EXISTS bookings_date_start_idx ON bookings (date, "startTime")');

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
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      )
    `);
    if (CAN_SEED_DEFAULT_USERS) {
      for (const username of DEFAULT_USER_NAMES) {
        await client.query(
          `INSERT INTO users (username, "passwordHash", role, "createdAt")
           VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING`,
          [username, hashPassword(DEFAULT_USER_PASSWORD), username === 'admin' ? 'admin' : 'photographer', new Date().toISOString()]
        );
      }
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
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
    if (String(username).length > 20 || String(password).length > 100) {
      return res.status(400).json({ error: '用户名或密码格式不正确' });
    }
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

app.get('/api/simple-video/config', requireAuth, async (req, res) => {
  res.json({ assignments: SIMPLE_VIDEO_ASSIGNMENTS });
});

app.put('/api/simple-video/config', requireAuth, requireAdmin, async (req, res) => {
  res.status(405).json({ error: '简易视频人员绑定由系统配置维护' });
});

app.get('/api/simple-video/tasks', requireAuth, async (req, res) => {
  try {
    const assignedPhotographers = Object.entries(SIMPLE_VIDEO_ASSIGNMENTS)
      .filter(([, recipient]) => recipient === req.user.username)
      .map(([photographer]) => photographer);
    if (assignedPhotographers.length === 0) return res.json([]);
    const today = getChinaDate();
    const tomorrow = getChinaDate(1);
    const dayAfterTomorrow = getChinaDate(2);
    const result = await pool.query(
      `SELECT bookings.*,
         CASE WHEN bookings.date = $1 THEN $3 ELSE $6 END AS "simpleVideoTargetDate",
         (
           SELECT owner_booking.id FROM bookings owner_booking
           WHERE owner_booking.photographer = $2
             AND owner_booking.date = CASE WHEN bookings.date = $1 THEN $3 ELSE $6 END
             AND owner_booking.studio = ANY($5::text[])
           ORDER BY owner_booking."startTime", owner_booking."createdAt"
           LIMIT 1
         ) AS "simpleVideoBookingId",
         (
           SELECT owner_booking."startTime" FROM bookings owner_booking
           WHERE owner_booking.photographer = $2
             AND owner_booking.date = CASE WHEN bookings.date = $1 THEN $3 ELSE $6 END
             AND owner_booking.studio = ANY($5::text[])
           ORDER BY owner_booking."startTime", owner_booking."createdAt"
           LIMIT 1
         ) AS "simpleVideoStartTime",
         (
           SELECT owner_booking."endTime" FROM bookings owner_booking
           WHERE owner_booking.photographer = $2
             AND owner_booking.date = CASE WHEN bookings.date = $1 THEN $3 ELSE $6 END
             AND owner_booking.studio = ANY($5::text[])
           ORDER BY owner_booking."startTime", owner_booking."createdAt"
           LIMIT 1
         ) AS "simpleVideoEndTime",
         EXISTS (
           SELECT 1 FROM bookings owner_booking
           WHERE owner_booking.photographer = $2
             AND owner_booking.date = CASE WHEN bookings.date = $1 THEN $3 ELSE $6 END
             AND owner_booking.studio = ANY($5::text[])
         ) AS "simpleVideoCompleted"
       FROM bookings
       WHERE "needsSimpleVideo" = TRUE AND date IN ($1, $3) AND photographer = ANY($4::text[])
       ORDER BY date, "startTime"`,
      [today, req.user.username, tomorrow, assignedPhotographers, SIMPLE_VIDEO_STUDIO_IDS, dayAfterTomorrow]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('获取简易视频待办失败:', error);
    res.status(500).json({ error: '获取简易视频待办失败' });
  }
});

app.post('/api/users', requireAuth, requireAdmin, writeLimiter, async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    if (!username || username.length > 20) return res.status(400).json({ error: '用户名格式不正确' });

    // 没有显式密码、也没配 DEFAULT_USER_PASSWORD 时，随机生成一个初始密码并回给管理员，
    // 好过让所有新账号共用同一个固定弱口令。
    const explicitPassword = String(req.body?.password || DEFAULT_USER_PASSWORD || '');
    const generatedPassword = explicitPassword ? '' : crypto.randomBytes(6).toString('base64url');
    const password = explicitPassword || generatedPassword;
    if (password.length < 6 || password.length > 100) {
      return res.status(400).json({ error: '密码长度需要为6到100位' });
    }

    const result = await pool.query(
      `INSERT INTO users (username, "passwordHash", role, "createdAt")
       VALUES ($1, $2, 'photographer', $3) RETURNING username, role, "createdAt"`,
      [username, hashPassword(password), new Date().toISOString()]
    );
    res.status(201).json(generatedPassword
      ? { ...result.rows[0], initialPassword: generatedPassword }
      : result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: '用户已存在' });
    console.error('添加用户失败:', error);
    res.status(500).json({ error: '添加用户失败' });
  }
});

app.delete('/api/users/:username', requireAuth, requireAdmin, writeLimiter, async (req, res) => {
  try {
    const username = req.params.username;
    if (username === 'admin') return res.status(400).json({ error: '不能删除管理员' });
    const result = await pool.query('DELETE FROM users WHERE username = $1', [username]);
    if (result.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    res.json({ message: '用户已删除' });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

app.post('/api/auth/change-password', requireAuth, writeLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || newPassword.length < 6 || newPassword.length > 100) {
      return res.status(400).json({ error: '密码格式不正确' });
    }
    const result = await pool.query('SELECT "passwordHash" FROM users WHERE username = $1', [req.user.username]);
    if (!result.rows[0] || !verifyPassword(currentPassword, result.rows[0].passwordHash)) {
      return res.status(401).json({ error: '当前密码错误' });
    }
    const newPasswordHash = hashPassword(newPassword);
    await pool.query('UPDATE users SET "passwordHash" = $1 WHERE username = $2', [newPasswordHash, req.user.username]);
    // 改密码会让所有旧 token 失效（包括本次请求用的那个），
    // 所以要立刻签发一个新 token 还给当前设备，避免用户改完密码就被踢下线。
    res.json({
      message: '密码修改成功',
      token: signToken({ username: req.user.username, role: req.user.role, passwordHash: newPasswordHash })
    });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// 获取预约。
// 不带任何参数时只返回昨天到后天，而不是整张表——预约页只需要这个窗口，
// 数据量长起来以后没有必要每 30 秒把全部历史扫一遍。
// 统计视图是全员可见的团队看板，确实需要全量历史，用显式的 all=1 拿。
app.get('/api/bookings', requireAuth, async (req, res) => {
  try {
    const fromDate = String(req.query.from || '');
    const toDate = String(req.query.to || '');

    if (req.query.all === '1') {
      const result = await pool.query('SELECT * FROM bookings ORDER BY date, "startTime"');
      return res.json(result.rows);
    }

    if ((fromDate || toDate) && (!isValidDateString(fromDate) || !isValidDateString(toDate) || fromDate > toDate)) {
      return res.status(400).json({ error: '日期范围无效' });
    }

    const result = await pool.query(
      'SELECT * FROM bookings WHERE date >= $1 AND date <= $2 ORDER BY date, "startTime"',
      [fromDate || getChinaDate(-1), toDate || getChinaDate(2)]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('获取预约失败:', error);
    res.status(500).json({ error: '获取预约失败' });
  }
});

// 创建新预约
app.post('/api/bookings', requireAuth, writeLimiter, async (req, res) => {
  try {
      const { id, studio, date, startTime, endTime, notes, simpleVideoTaskId } = req.body;
    // 简易视频待办只围绕今天/明天运转，这里刻意不传 studio，
    // 6F 实景棚放宽到 7 天不影响这个开关的判定窗口。
    const needsSimpleVideo = studio !== '6F无影棚' && isValidBookingDate(date) && req.body?.needsSimpleVideo === true;

    if (!id || !studio || !date || !startTime || !endTime) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    if (!STUDIO_IDS.includes(studio)) return res.status(400).json({ error: '影棚无效' });
    if (FROZEN_STUDIO_IDS.has(studio)) return res.status(400).json({ error: '该影棚暂时冻结，无法预约' });
    const validBookingDate = isValidBookingDate(date, studio)
      || await isAuthorizedSimpleVideoBooking(req.user, simpleVideoTaskId, date, studio);
    if (!validBookingDate) {
      return res.status(400).json({ error: `${describeBookingWindow(studio)}；简易视频人员可从待办预约对应日期` });
    }
    if (!isValidBookingRange(startTime, endTime)) return res.status(400).json({ error: '时间必须在营业时段内，且按15分钟预约' });
    if (!isBookingStartAvailable(date, startTime)) return res.status(400).json({ error: '今天的开始时间已过期，请选择当前时间之后的时段' });

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
      INSERT INTO bookings (id, studio, date, "startTime", "endTime", photographer, contact, notes, "needsSimpleVideo", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

      const result = await client.query(insertQuery, [
        id, studio, date, startTime, endTime, req.user.username, req.user.username, notes || '', needsSimpleVideo, createdAt
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
app.put('/api/bookings/:id', requireAuth, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { studio, date, startTime, endTime, notes } = req.body || {};
    // 简易视频待办只围绕今天/明天运转，这里刻意不传 studio，
    // 6F 实景棚放宽到 7 天不影响这个开关的判定窗口。
    const needsSimpleVideo = studio !== '6F无影棚' && isValidBookingDate(date) && req.body?.needsSimpleVideo === true;
    if (!studio || !date || !startTime || !endTime) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    if (!STUDIO_IDS.includes(studio)) return res.status(400).json({ error: '影棚无效' });
    if (FROZEN_STUDIO_IDS.has(studio)) return res.status(400).json({ error: '该影棚暂时冻结，无法预约' });
    if (!isValidBookingRange(startTime, endTime)) {
      return res.status(400).json({ error: '时间必须在营业时段内，且按15分钟预约' });
    }
    if (!isBookingStartAvailable(date, startTime)) {
      return res.status(400).json({ error: '今天的开始时间已过期，请选择当前时间之后的时段' });
    }

    const client = await pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${studio}:${date}`]);

      const existing = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id]);
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '预约不存在' });
      }
      const booking = existing.rows[0];
      if (req.user.role !== 'admin' && booking.photographer !== req.user.username) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: '只能修改自己的预约' });
      }
      if (!isEditableBooking(booking)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '已过期预约不能修改' });
      }
      const validBookingDate = isValidBookingDate(date, studio)
        || (booking.date === getChinaDate(2) && date === getChinaDate(2)
          && SIMPLE_VIDEO_STUDIO_IDS.includes(studio));
      if (!validBookingDate) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `${describeBookingWindow(studio)}；简易视频预约只能修改原定后天日期` });
      }

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
         SET studio = $1, date = $2, "startTime" = $3, "endTime" = $4, notes = $5, "needsSimpleVideo" = $6
         WHERE id = $7
         RETURNING *`,
        [studio, date, startTime, endTime, notes || '', needsSimpleVideo, id]
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
app.delete('/api/bookings/:id', requireAuth, writeLimiter, async (req, res) => {
  let client;
  let transactionStarted = false;
  try {
    const { id } = req.params;
    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    const existing = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '预约不存在' });
    }
    const booking = existing.rows[0];
    if (req.user.role !== 'admin' && booking.photographer !== req.user.username) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: '只能取消自己的预约' });
    }
    if (!isEditableBooking(booking)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '已结束预约不能取消' });
    }
    const result = await client.query('DELETE FROM bookings WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '预约不存在' });
    }

    await client.query('COMMIT');
    transactionStarted = false;
    res.json({ message: '删除成功' });
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
    console.error('删除预约失败:', error);
    res.status(500).json({ error: '取消预约失败' });
  } finally {
    client?.release();
  }
});

// 健康检查
app.get('/health', async (req, res) => {
  if (!AUTH_SECRET) return res.status(503).json({ status: 'error', error: '认证配置不可用' });
  try {
    await databaseReady;
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'ok' });
  } catch (error) {
    console.error('健康检查失败:', error);
    res.status(503).json({ status: 'error', error: '数据库不可用' });
  }
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: '影棚预约系统 API',
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

