const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync('studio-layout.js', 'utf8');
const styles = fs.readFileSync('studio-layout.css', 'utf8');
const context = vm.createContext({});
for (const pattern of [
    /const SIXTH_FLOOR_SNAP_THRESHOLD = [^;]+;/,
    /function getSixthFloorSnapTargets\([\s\S]*?\n\}/,
    /function snapSixthFloorCard\([\s\S]*?\n\}/
]) vm.runInContext(source.match(pattern)[0], context);

test('移动卡片可吸附到相邻卡片边缘和中心线', () => {
    const layout = {
        active: { x: 90, y: 90, width: 100, height: 80 },
        reference: { x: 200, y: 100, width: 120, height: 100 }
    };
    const result = context.snapSixthFloorCard(layout, 'active', layout.active, 'move');
    assert.equal(result.card.x, 100);
    assert.equal(result.card.y, 100);
    assert.equal(result.guideX, 200);
    assert.equal(result.guideY, 100);
});

test('缩放卡片可吸附到相邻卡片边缘，Alt 可临时关闭吸附', () => {
    const layout = {
        active: { x: 20, y: 20, width: 172, height: 172 },
        reference: { x: 200, y: 200, width: 100, height: 100 }
    };
    const snapped = context.snapSixthFloorCard(layout, 'active', layout.active, 'resize');
    assert.equal(snapped.card.width, 180);
    assert.equal(snapped.card.height, 180);
    const free = context.snapSixthFloorCard(layout, 'active', layout.active, 'resize', true);
    assert.equal(free.card.width, 172);
    assert.equal(free.guideX, null);
});

test('画布包含对齐辅助线、尺寸提示和基础网格吸附', () => {
    assert.match(source, /data-alignment-guide="vertical"/);
    assert.match(source, /data-alignment-guide="horizontal"/);
    assert.match(source, /data-card-metrics/);
    assert.match(source, /SIXTH_FLOOR_GRID_SIZE/);
    assert.match(source, /event\.altKey/);
    assert.match(styles, /\.sixth-floor-alignment-guide\.vertical/);
    assert.match(styles, /\.sixth-floor-card-metrics/);
});
