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
