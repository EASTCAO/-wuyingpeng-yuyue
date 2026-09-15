const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(projectRoot, 'api', 'server.js'), 'utf8');

function readArraySource(source, declaration, closingMarker) {
    const start = source.indexOf(declaration);
    const end = source.indexOf(closingMarker, start);
    assert.notEqual(start, -1, `找不到 ${declaration}`);
    assert.notEqual(end, -1, `找不到 ${declaration} 的结束位置`);
    return source.slice(start, end);
}

function readQuotedValues(source) {
    return [...source.matchAll(/'([^']+)'/g)].map(match => match[1]);
}

test('前端展示的所有影棚都被后端允许预约', () => {
    const frontendConfig = readArraySource(appSource, 'const STUDIO_GROUPS = [', '\n];\n\nfunction getAllStudios');
    const backendConfig = readArraySource(serverSource, 'const STUDIO_IDS = [', '\n];\nconst FROZEN_STUDIO_IDS');
    const frontendStudios = [...frontendConfig.matchAll(/\{ id: '([^']+)'/g)].map(match => match[1]);
    const backendStudios = readQuotedValues(backendConfig);

    assert.deepEqual(
        [...new Set(backendStudios)].sort(),
        [...new Set(frontendStudios)].sort(),
        '前后端影棚名单不一致，用户会看到无法在线预约的棚位'
    );
});

test('放宽到 7 天的棚位清单和 6F 实景棚配置完全一致', () => {
    const rules = require('../shared/booking-rules');

    // app.js 的 6F 实景棚分组
    const groupSource = readArraySource(
        appSource,
        "key: 'real-scene-sixth-floor'",
        '\n        ]'
    );
    const groupIds = [...groupSource.matchAll(/id: '([^']+)'/g)].map(match => match[1]);

    assert.equal(groupIds.length, 22, '6F 实景棚包含参考图场景、茶水间及5楼阳台');
    assert.deepEqual(
        [...rules.EXTENDED_WINDOW_STUDIO_IDS].sort(),
        [...groupIds].sort(),
        '放宽名单必须和 app.js 的 6F 实景棚分组逐个对应'
    );

    // 后端也必须认识这些棚位，否则前端放开了后端会拒绝
    const serverIds = readQuotedValues(readArraySource(serverSource, 'const STUDIO_IDS = [', '\n];'));
    for (const id of rules.EXTENDED_WINDOW_STUDIO_IDS) {
        assert.ok(serverIds.includes(id), `后端 STUDIO_IDS 缺少 ${id}`);
    }

    // 反向保险：名单之外的棚位不该被放宽
    for (const id of serverIds) {
        const expected = rules.EXTENDED_WINDOW_STUDIO_IDS.includes(id) ? 7 : 2;
        assert.equal(rules.getBookingWindowDays(id), expected, `${id} 的预约窗口不对`);
    }
    assert.equal(rules.getBookingWindowDays('6F无影棚'), 2, '6F 无影棚不在放宽范围内');
});

test('新增登录账号同时加入前端本地模式和后端默认账号', () => {
    const expectedUsers = [
        '陈洋', '罗暄', '汤诗槐', '刘家其', '孙焱林', '曾雪萍',
        '刘朝洋', '王子一', '何丽源', '郭海英', '张玉洁', '胡敏雯', '郭卢彤', '吴语琳'
    ];
    const frontendUsers = readQuotedValues(
        readArraySource(appSource, 'const DEFAULT_USERS = {', '\n};')
    );
    const backendUsers = readQuotedValues(
        readArraySource(serverSource, 'const DEFAULT_USER_NAMES = [', '\n];')
    );

    for (const username of expectedUsers) {
        assert.ok(frontendUsers.includes(username), `前端默认用户缺少 ${username}`);
        assert.ok(backendUsers.includes(username), `后端默认用户缺少 ${username}`);
    }
});

test('6F 实景棚左侧摄影师预约时间段保持只读', () => {
    const renderSource = readArraySource(
        appSource,
        'function renderAvailabilityPanel()',
        '\nfunction openAvailabilityBooking'
    );

    assert.match(renderSource, /studioInfo\?\.groupKey === 'real-scene-sixth-floor'/);
    assert.match(renderSource, /if \(isSixthFloorRealScene \|\| !canCancelBooking\(booking\)\)/);
});
