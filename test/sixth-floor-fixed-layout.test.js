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

test('画布不再提供手动缩放、平移和复位', () => {
    assert.doesNotMatch(source, /sixthFloorPanState|resetSixthFloorLayout|SIXTH_FLOOR_MIN_SCALE/);
    assert.doesNotMatch(source, /addEventListener\('wheel'/);
    assert.match(source, /function bindSixthFloorCanvas\(\)[\s\S]*?fitSixthFloorCanvasToViewport\(loadSixthFloorLayout\(\)\);/);
});

test('6F 景名跟着卡片尺寸放大，缩到屏幕后仍然明显', () => {
    // 画布整体会被缩到约 42%，固定字号跟着一起缩小，所以必须按卡片尺寸计算。
    // 同选择器有"颜色"和"字号"两条规则，这里只取带 font-size 的那条。
    const rules = [...styles.matchAll(/\.preview-floor-map-sixth-floor \.preview-scene-card h4\s*\{([\s\S]*?)\n\}/g)]
        .map(match => match[1]);
    const rule = rules.find(body => /font-size:/.test(body));
    assert.ok(rule, '没有找到 6F 景名规则');
    assert.match(rule, /font-size:\s*clamp\(\s*32px,\s*min\(calc\(var\(--card-width\)/);
    assert.match(rule, /calc\(var\(--card-height\)/);
    assert.match(rule, /font-weight:\s*700/);
    assert.doesNotMatch(rule, /font-size:\s*19px/);
});
