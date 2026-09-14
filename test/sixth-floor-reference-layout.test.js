const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const source = fs.readFileSync('studio-layout.js', 'utf8');
const layout = vm.runInNewContext(`(${source.match(/const SIXTH_FLOOR_DEFAULT_LAYOUT = (\{[\s\S]*?\n\});/)[1]})`);
const size = vm.runInNewContext(`(${source.match(/const SIXTH_FLOOR_CANVAS_SIZE = (\{[^;]+\});/)[1]})`);
const app = fs.readFileSync('app.js', 'utf8').split("key: 'real-scene-sixth-floor'")[1].split('\n        ]')[0];
const keys = [...app.matchAll(/mapArea: '([^']+)'/g)].map(match => match[1]);

test('每个场景独占一个位置，所有卡片均在画布内且不重叠', () => {
    assert.equal(new Set(keys).size, keys.length);
    assert.deepEqual(keys.sort(), Object.keys(layout).sort());
    for (const [key, a] of Object.entries(layout)) {
        assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.width <= size.width && a.y + a.height <= size.height, key);
        for (const [other, b] of Object.entries(layout)) {
            if (key === other) continue;
            assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x ||
                a.y + a.height <= b.y || b.y + b.height <= a.y, `${key} 与 ${other} 重叠`);
        }
    }
});

test('上排和下排的左右顺序与参考图一致', () => {
    for (const row of [
        ['corridor', 'kids', 'classroom', 'study', 'vintage-dining', 'modern-living', 'modern-dining', 'tea-room'],
        ['greenery', 'bedroom', 'bathroom', 'bar', 'chinese', 'workshop', 'modern-kitchen']
    ]) {
        for (let i = 1; i < row.length; i++) {
            assert.ok(layout[`sixth-${row[i - 1]}`].x < layout[`sixth-${row[i]}`].x);
        }
    }
    assert.ok(layout['fifth-balcony'].x > layout['sixth-modern-kitchen'].x);
});

test('医护室在教室下、海洋区在其下，咖啡窗台在吧台上，街道在客餐厅下', () => {
    for (const [above, below] of [
        ['classroom', 'clinic'], ['clinic', 'ocean-wall'], ['outdoor-cafe', 'bar'],
        ['vintage-dining', 'street'], ['modern-living', 'street'], ['modern-dining', 'street'],
        ['corridor', 'wood-wall'], ['wood-wall', 'greenery']
    ]) {
        assert.ok(layout[`sixth-${above}`].y + layout[`sixth-${above}`].height <= layout[`sixth-${below}`].y);
    }
});
