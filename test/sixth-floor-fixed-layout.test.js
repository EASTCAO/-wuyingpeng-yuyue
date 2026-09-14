const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync('studio-layout.js', 'utf8');
const styles = fs.readFileSync('studio-layout.css', 'utf8');

test('固定布局每次返回独立副本，旧个人存储不会覆盖', () => {
    const context = vm.createContext({
        structuredClone,
        localStorage: { getItem() { throw new Error('不应读取个人布局'); } }
    });
    vm.runInContext(source.match(/const SIXTH_FLOOR_DEFAULT_LAYOUT = \{[\s\S]*?\n\};/)[0] +
        source.match(/function loadSixthFloorLayout\(\)[\s\S]*?\n\}/)[0], context);
    const first = context.loadSixthFloorLayout();
    first['sixth-corridor'].width = 1;
    assert.equal(context.loadSixthFloorLayout()['sixth-corridor'].width, 626);
    assert.equal(Object.keys(context.loadSixthFloorLayout()).length, 22);
});

test('移除智能吸附、辅助线和尺寸提示', () => {
    assert.doesNotMatch(source, /snapSixthFloorCard|SIXTH_FLOOR_GRID_SIZE|data-alignment-guide|data-card-metrics/);
    assert.doesNotMatch(styles, /sixth-floor-alignment-guide|sixth-floor-card-metrics/);
});

test('复位只恢复视图，不删除用户存储', () => {
    const reset = source.match(/function resetSixthFloorLayout\(\)[\s\S]*?\n\}/)[0];
    assert.doesNotMatch(reset, /localStorage/);
    assert.match(reset, /sixthFloorViewport = \{ x: 0, y: 0, scale: 1 \}/);
});
