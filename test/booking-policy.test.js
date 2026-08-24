const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const serverSource = fs.readFileSync(path.join(projectRoot, 'api', 'server.js'), 'utf8');

// 规则本身的正确性由 test/booking-rules.test.js 直接调用真函数验证，
// 这里只负责确认前后端都确实接在同一份规则上，没有绕过去自己判断。
test('前后端都禁止取消已经结束的预约', () => {
    assert.match(appSource, /isBookingEditable\(booking\)/);
    assert.match(serverSource, /function isEditableBooking\(booking\) \{\s*return isBookingEditable\(booking\);/);
    assert.match(serverSource, /if \(!isEditableBooking\(booking\)\) \{[\s\S]*?已结束预约不能取消/);
});

test('登录接口限制连续失败尝试', () => {
    assert.match(serverSource, /const loginLimiter = rateLimit\(\{/);
    assert.match(serverSource, /windowMs: 10 \* 60 \* 1000/);
    assert.match(serverSource, /limit: 10/);
    assert.match(serverSource, /app\.set\('trust proxy', 1\)/);
    assert.match(serverSource, /app\.post\('\/api\/auth\/login', loginLimiter/);
});

test('预约状态统一按上海时区判断', () => {
    // 前端不再自己算状态，一律走共享模块的 getBookingStatus。
    assert.match(appSource, /getBookingStatus\(booking\)/);
    assert.doesNotMatch(appSource, /formatDateToString/);
    assert.doesNotMatch(appSource, /new Intl\.DateTimeFormat/);
});

test('创建和修改预约都禁止选择今天已经过去的开始时间', () => {
    assert.match(appSource, /if \(!isBookingStartAvailable\(date, startTime\)\) \{/);
    assert.match(serverSource, /if \(!isBookingStartAvailable\(date, startTime\)\) return res\.status\(400\)/);
    assert.match(serverSource, /if \(!isBookingStartAvailable\(date, startTime\)\) \{[\s\S]*?今天的开始时间已过期/);
});

test('预约编号使用随机 UUID，避免并发提交主键冲突', () => {
    assert.match(appSource, /function createBookingId\(\)/);
    assert.match(appSource, /globalThis\.crypto\?\.randomUUID/);
    assert.match(appSource, /id: activeEditingId \|\| createBookingId\(\)/);
});

test('线上环境隐藏不可用的游客入口', () => {
    assert.match(htmlSource, /id="guestLoginButton"/);
    assert.match(appSource, /document\.getElementById\('guestLoginButton'\)\?\.classList\.add\('hidden'\)/);
});
