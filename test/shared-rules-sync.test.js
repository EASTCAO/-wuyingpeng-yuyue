// 后端在 Zeabur 上以 ./api 为构建根目录，require 不到仓库根目录的 shared/，
// 所以 api/booking-rules.js 是 shared/booking-rules.js 的自动同步副本。
// 忘记同步会让前后端规则悄悄分叉，这里直接把它变成一个测试失败。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

test('api/booking-rules.js 与 shared/booking-rules.js 完全一致', () => {
    const canonical = fs.readFileSync(path.join(projectRoot, 'shared', 'booking-rules.js'), 'utf8');
    const vendored = fs.readFileSync(path.join(projectRoot, 'api', 'booking-rules.js'), 'utf8');
    assert.equal(
        vendored,
        canonical,
        '两份文件已经分叉，请运行 `node scripts/sync-shared.js` 重新同步'
    );
});

test('共享模块同时支持 Node require 和浏览器全局加载', () => {
    const source = fs.readFileSync(path.join(projectRoot, 'shared', 'booking-rules.js'), 'utf8');
    assert.match(source, /typeof module === 'object' && module\.exports/);
    assert.match(source, /Object\.assign\(root, bookingRules\)/);

    // 浏览器端靠 <script> 标签加载，顺序必须排在 app.js 之前。
    const htmlSource = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
    const rulesIndex = htmlSource.indexOf('shared/booking-rules.js');
    const appIndex = htmlSource.indexOf('src="app.js');
    assert.ok(rulesIndex > -1, 'index.html 必须加载 shared/booking-rules.js');
    assert.ok(rulesIndex < appIndex, 'booking-rules.js 必须在 app.js 之前加载');

    // 离线可用：Service Worker 预缓存列表里必须有它。
    const serviceWorkerSource = fs.readFileSync(path.join(projectRoot, 'sw.js'), 'utf8');
    assert.match(serviceWorkerSource, /'\.\/shared\/booking-rules\.js'/);
});

test('前端不再保留各自的规则副本，统一走共享模块', () => {
    const appSource = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
    const serverSource = fs.readFileSync(path.join(projectRoot, 'api', 'server.js'), 'utf8');

    // Intl.DateTimeFormat 只允许在共享模块里构造一次并复用。
    assert.doesNotMatch(appSource, /new Intl\.DateTimeFormat/);
    assert.doesNotMatch(serverSource, /new Intl\.DateTimeFormat/);

    // 营业时段和时段校验不能再各写一份。
    assert.doesNotMatch(appSource, /const BOOKABLE_PERIODS = \[/);
    assert.doesNotMatch(serverSource, /const BOOKABLE_PERIODS = \[/);
    assert.doesNotMatch(appSource, /function isValidBookingRange\(/);
    assert.doesNotMatch(serverSource, /function isValidBookingRange\(/);

    assert.match(serverSource, /require\('\.\/booking-rules'\)/);
});
