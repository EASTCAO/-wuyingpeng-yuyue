// 预约状态（未开始 / 进行中 / 已结束 / 已过期）随时间自己翻转，
// 但重渲染原来只挂在 loadBookings 上——那是数据驱动的。
// 后果：本地模式完全没有轮询，页面开着过了 18:15 也不会变成"已过期"；
// 云端模式下请求失败或标签页在后台跳过轮询时，状态同样停在旧值。
//
// 这些断言是源码级的（定时器行为依赖 DOM 和真实计时，不适合纯函数测试），
// 挡不住逻辑写错，但能挡住"这个定时器被人删掉或退化成依赖网络"。
// 时间翻转本身的正确性由 test/booking-rules.test.js 的 getBookingStatus
// 和 isBookingEditable 覆盖。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
const layoutSource = fs.readFileSync(path.join(projectRoot, 'studio-layout.js'), 'utf8');

function functionBody(source, header) {
    const start = source.indexOf(header);
    assert.notEqual(start, -1, `找不到 ${header}`);
    return source.slice(start, source.indexOf('\n}', start));
}

test('存在独立于网络的状态刷新定时器', () => {
    const body = functionBody(appSource, 'function startStateRefresh()');
    assert.match(body, /setInterval\(/, '必须是定时器');
    assert.match(body, /renderAllViews\(\)/, '必须触发重渲染');
    // 关键：不能依赖任何网络调用，否则请求失败时状态就停住了
    assert.doesNotMatch(body, /loadBookings|apiFetch|fetch\(/, '状态刷新不能依赖网络请求');
    assert.doesNotMatch(body, /isCloudMode/, '本地模式也必须刷新');
});

test('状态刷新在后台标签页和写入过程中让路', () => {
    const body = functionBody(appSource, 'function startStateRefresh()');
    assert.match(body, /if \(!isPageVisible\(\)\) return;/, '后台标签页应跳过');
    assert.match(body, /bookingSaveInFlight \|\| bookingDeleteInFlight/, '写入过程中应跳过');
});

test('状态刷新在登录后启动，在退出和掉线时清理', () => {
    assert.match(appSource, /startAutoRefresh\(\);\s*\n\s*\/\/[^\n]*\n\s*startStateRefresh\(\);/,
        '登录进入主页面时应启动');
    // 退出登录和 401 掉线都要停，否则定时器泄漏
    const stops = appSource.match(/stopStateRefresh\(\);/g) || [];
    assert.ok(stops.length >= 2, `stopStateRefresh 至少要在退出和掉线两处调用，实际 ${stops.length} 处`);
    assert.match(functionBody(appSource, 'function stopStateRefresh()'), /clearInterval\(/);
});

test('渲染签名包含时间桶，否则状态翻转不会触发重渲染', () => {
    const body = functionBody(appSource, 'function getRenderSignature()');
    // 时间必须进签名：所有预约时间都在 15 分钟网格上，按此取整即可覆盖全部状态切换点
    assert.match(body, /BOOKING_INTERVAL_MINUTES/);
    assert.match(body, /getChinaCurrentTime\(\)/);
    assert.match(body, /minutesToTime\(bucketMinutes\)/);
});

test('实景棚画布的状态由同一条渲染链驱动', () => {
    // renderAllViews -> renderBookings -> renderRealSceneOverview
    // 这条链断了的话，6F 画布上的"已过期"就不会刷新
    assert.match(functionBody(appSource, 'function renderAllViews('), /renderBookings\(\)/);
    assert.match(
        functionBody(layoutSource, 'renderBookings = function renderStudioLayoutBookings()'),
        /renderRealSceneOverview\(\)/
    );
    assert.match(layoutSource, /const isEndedToday = date === getChinaDate\(\) && getChinaCurrentTime\(\) > lastBookableStart;/);
});
