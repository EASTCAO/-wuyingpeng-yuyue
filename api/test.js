#!/usr/bin/env node

const crypto = require('crypto');

const API_BASE_URL = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const TEST_USERNAME = process.env.TEST_USERNAME || '';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '';
const BOOKABLE_PERIODS = [
  { start: '08:30', end: '12:30' },
  { start: '14:00', end: '18:30' }
];
const STUDIO_IDS = [
  '大无影棚1（工位对面）', '大无影棚2（鄢军隔壁）',
  '小无影棚3', '小无影棚4', '6F无影棚',
  '小木屋景', '卧室景', '酒吧景', '书房景', '客厅景',
  '木纹台面-厨房景', '儿童房景/户外下午茶景', '工具台景',
  '洗衣房景别', '黑色台面-厨房景', '浴室景'
];

let authToken = '';
let passed = 0;
let failed = 0;

function getChinaDate(offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(Date.now() + offsetDays * 86400000));
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  if (options.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function test(name, callback) {
  try {
    await callback();
    passed += 1;
    console.log(`通过: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`失败: ${name} - ${error.message}`);
  }
}

function expectStatus(result, status) {
  if (result.response.status !== status) {
    throw new Error(`期望 ${status}，实际 ${result.response.status}: ${JSON.stringify(result.data)}`);
  }
}

function findFreeSlot(bookings, date) {
  for (const studio of STUDIO_IDS) {
    const studioBookings = bookings.filter(booking => booking.studio === studio && booking.date === date);
    for (const period of BOOKABLE_PERIODS) {
      for (let start = timeToMinutes(period.start); start < timeToMinutes(period.end); start += 15) {
        const startTime = minutesToTime(start);
        const endTime = minutesToTime(start + 15);
        const conflict = studioBookings.some(booking => !(endTime <= booking.startTime || startTime >= booking.endTime));
        if (!conflict) return { studio, startTime, endTime };
      }
    }
  }
  return null;
}

async function run() {
  console.log(`API: ${API_BASE_URL}`);

  await test('健康检查包含数据库状态', async () => {
    const result = await request('/health');
    expectStatus(result, 200);
    if (result.data.status !== 'ok' || result.data.database !== 'ok') {
      throw new Error(`健康状态异常: ${JSON.stringify(result.data)}`);
    }
  });

  await test('未登录不能读取预约', async () => {
    const result = await request('/api/bookings');
    expectStatus(result, 401);
  });

  await test('错误账号不能登录', async () => {
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: `test_${Date.now()}`, password: 'invalid-password' })
    });
    expectStatus(result, 401);
  });

  if (!TEST_USERNAME || !TEST_PASSWORD) {
    console.log('未设置 TEST_USERNAME/TEST_PASSWORD，跳过需要登录的增删改测试。');
  } else {
    await test('账号登录', async () => {
      const result = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD })
      });
      expectStatus(result, 200);
      if (!result.data.token) throw new Error('响应中没有登录令牌');
      authToken = result.data.token;
    });

    let createdId = '';
    try {
      let bookings = [];
      await test('登录后读取预约', async () => {
        const result = await request('/api/bookings');
        expectStatus(result, 200);
        if (!Array.isArray(result.data)) throw new Error('预约列表格式错误');
        bookings = result.data;
      });

      const date = getChinaDate(1);
      const slot = findFreeSlot(bookings, date);
      if (!slot) throw new Error('没有可用于测试的空闲时段');
      createdId = `smoke-${crypto.randomUUID()}`;
      const payload = { id: createdId, date, notes: '自动化冒烟测试', ...slot };

      await test('创建预约', async () => {
        const result = await request('/api/bookings', { method: 'POST', body: JSON.stringify(payload) });
        expectStatus(result, 201);
      });

      await test('阻止重叠预约', async () => {
        const result = await request('/api/bookings', {
          method: 'POST',
          body: JSON.stringify({ ...payload, id: `smoke-conflict-${crypto.randomUUID()}` })
        });
        expectStatus(result, 409);
      });

      await test('阻止午休时间预约', async () => {
        const result = await request('/api/bookings', {
          method: 'POST',
          body: JSON.stringify({ ...payload, id: `smoke-lunch-${crypto.randomUUID()}`, startTime: '12:30', endTime: '14:00' })
        });
        expectStatus(result, 400);
      });
    } finally {
      if (createdId) {
        await test('清理测试预约', async () => {
          const result = await request(`/api/bookings/${encodeURIComponent(createdId)}`, { method: 'DELETE' });
          expectStatus(result, 200);
        });
      }
    }
  }

  console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(error => {
  console.error(`测试中止: ${error.message}`);
  process.exit(1);
});
