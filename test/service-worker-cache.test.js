const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const htmlSource = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(projectRoot, 'sw.js'), 'utf8');

test('前端脚本带版本号，内容变化一定会改变 URL', () => {
    assert.match(htmlSource, /app\.js\?v=[^"']+/);
    assert.match(htmlSource, /studio-layout\.js\?v=[^"']+/);
    assert.match(htmlSource, /shared\/booking-rules\.js\?v=[^"']+/);
    assert.match(htmlSource, /style\.css\?v=[^"']+/);
});

test('带版本号的静态资源走缓存优先，首屏不必等网络往返', () => {
    assert.match(serviceWorkerSource, /function isVersionedAsset\(request\)/);
    assert.match(serviceWorkerSource, /url\.searchParams\.has\('v'\)/);
    // 缓存命中直接返回，网络请求只在后台刷新。
    assert.match(serviceWorkerSource, /caches\.match\(event\.request\)\.then\(cached =>/);
    const versionedBranch = serviceWorkerSource.slice(
        serviceWorkerSource.indexOf('if (isVersionedAsset(event.request))'),
        serviceWorkerSource.indexOf("event.respondWith(\n    fetch(event.request)")
    );
    assert.doesNotMatch(versionedBranch, /ignoreSearch: true/);
    assert.match(serviceWorkerSource, /return cached \|\| network/);
});

test('页面导航仍然网络优先，保证能拿到最新页面', () => {
    assert.match(
        serviceWorkerSource,
        /event\.request\.mode === 'navigate'[\s\S]*?fetch\(event\.request\)[\s\S]*?putInCache/
    );
});

test('网络失败时仍可回退到离线缓存', () => {
    assert.match(serviceWorkerSource, /\.catch\(async \(\) => await caches\.match\(event\.request\)/);
    assert.match(serviceWorkerSource, /caches\.match\(event\.request, \{ ignoreSearch: true \}\)/);
    // 版本化资源断网时回退到已缓存的那一份。
    assert.match(serviceWorkerSource, /\.catch\(\(\) => cached\)/);
});

test('缓存版本号跟着资源一起升级，激活时清掉旧缓存', () => {
    assert.match(serviceWorkerSource, /const CACHE_NAME = 'studio-booking-v\d+/);
    assert.match(serviceWorkerSource, /caches\.delete\(cacheName\)/);
});
