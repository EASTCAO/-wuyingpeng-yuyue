const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync('studio-layout.js', 'utf8');
const context = vm.createContext({});
vm.runInContext(source.match(/const SIXTH_FLOOR_CANVAS_SIZE = [^;]+;/)[0] +
    source.match(/function resizeSixthFloorCard\([\s\S]*?\n\}/)[0], context);

test('宽高可独立调整，不锁定原比例、不改变坐标', () => {
    const card = { x: 40, y: 60, width: 264, height: 120 };
    const next = context.resizeSixthFloorCard(card, 480, 100);
    assert.equal(next.width, 480);
    assert.equal(next.height, 100);
    assert.equal(next.x, 40);
    assert.equal(next.y, 60);
    assert.equal(card.width, 264);
});

test('缩放受最小尺寸和画布边界限制', () => {
    const card = { x: 3000, y: 1400, width: 200, height: 100 };
    const small = context.resizeSixthFloorCard(card, -10, 0);
    assert.equal(small.width, 120);
    assert.equal(small.height, 80);
    const large = context.resizeSixthFloorCard(card, 10000, 10000);
    assert.equal(large.width, 280);
    assert.equal(large.height, 160);
});

test('手柄隔离预约点击，鼠标缩放按画布倍率换算并保存', () => {
    assert.match(source, /onclick="event.stopPropagation\(\)"/);
    assert.match(source, /else if \(!state.resizing\)/);
    assert.match(source, /state.original.width \+ dx \/ sixthFloorViewport.scale/);
    assert.match(source, /state.original.height \+ dy \/ sixthFloorViewport.scale/);
    assert.match(source, /saveSixthFloorLayout\(layout\)/);
    assert.match(source, /onkeydown="handleSixthFloorResizeKey/);
});
