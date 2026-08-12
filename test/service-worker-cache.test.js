const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const htmlSource = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(projectRoot, 'sw.js'), 'utf8');

test('前端脚本使用版本参数，静态资源在线时优先获取新版本', () => {
    assert.match(htmlSource, /app\.js\?v=[^"']+/);
    assert.match(htmlSource, /studio-layout\.js\?v=[^"']+/);
    assert.match(serviceWorkerSource, /fetch\(event\.request\)[\s\S]*cache\.put\(event\.request, response\.clone\(\)\)/);
});

test('网络失败时仍可回退到离线缓存', () => {
    assert.match(serviceWorkerSource, /\.catch\(async \(\) => await caches\.match\(event\.request\)/);
    assert.match(serviceWorkerSource, /caches\.match\(event\.request, \{ ignoreSearch: true \}\)/);
});
