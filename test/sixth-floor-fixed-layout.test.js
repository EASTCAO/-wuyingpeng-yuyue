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

test('6F 景名统一固定字号，不跟着卡片大小变化', () => {
    // 画布整体会被缩到约 42%，所以画布坐标里的字号要明显大于正文。
    // 同选择器有"颜色"和"字号"两条规则，这里只取带 font-size 的那条。
    const rules = [...styles.matchAll(/\.preview-floor-map-sixth-floor \.preview-scene-card h4\s*\{([\s\S]*?)\n\}/g)]
        .map(match => match[1]);
    const rule = rules.find(body => /font-size:/.test(body));
    assert.ok(rule, '没有找到 6F 景名规则');
    const size = rule.match(/font-size:\s*(\d+)px/);
    assert.ok(size, '景名字号应为固定像素值');
    // 画布缩到屏幕上（约 42%）之后约等于正文大小，再小就看不清了。
    assert.ok(Number(size[1]) >= 32, `景名字号 ${size[1]}px 偏小`);
    // 卡片尺寸一旦参与计算，大字卡的字就会跟着变大，这正是要避免的。
    assert.doesNotMatch(rule, /clamp\(/);
    assert.doesNotMatch(rule, /var\(--card-width\)/);
    assert.doesNotMatch(rule, /var\(--card-height\)/);
    // 字重跟参考图走，是常规字重，不是加粗的黑体。
    assert.match(rule, /font-weight:\s*400/);
    assert.doesNotMatch(rule, /font-size:\s*19px/);
});

test('细高竖列卡片的景名改成竖排，并沿用统一字号', () => {
    assert.match(source, /const verticalTitle = Boolean\(position && position\.height >= position\.width \* 2\)/);
    assert.match(source, /\$\{verticalTitle \? ' is-vertical-title' : ''\}/);

    const rule = styles.match(
        /\.preview-floor-map-sixth-floor \.sixth-floor-layout-card\.preview-scene-card\.is-vertical-title h4\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(rule, '没有找到竖排景名规则');
    assert.match(rule[1], /writing-mode:\s*vertical-rl/);
    assert.match(rule[1], /text-orientation:\s*upright/);
    assert.match(rule[1], /letter-spacing:/);
    // 竖排卡不能再来自定义字号，否则又会跟卡片尺寸挂钩。
    assert.doesNotMatch(rule[1], /font-size:/);
});

test('满约的细高卡片保留已约满标签', () => {
    const rule = styles.match(
        /\.preview-floor-map-sixth-floor \.sixth-floor-layout-card\.preview-scene-card\.full\.is-vertical-title h4\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(rule, '没有找到满约竖排景名的布局覆盖');
    assert.match(rule[1], /height:\s*auto/);
});

test('竖排只落在真正细高的三张卡片上', () => {
    const context = vm.createContext({});
    vm.runInContext(source.match(/const SIXTH_FLOOR_DEFAULT_LAYOUT = \{[\s\S]*?\n\};/)[0], context);
    // 同一 context 里的后续脚本能读到前面 const 声明的词法绑定（但它不是 context 属性）。
    const layout = vm.runInContext('SIXTH_FLOOR_DEFAULT_LAYOUT', context);
    const vertical = Object.entries(layout)
        .filter(([, card]) => card.height >= card.width * 2)
        .map(([key]) => key)
        .sort();
    assert.deepEqual(vertical, ['fifth-balcony', 'sixth-greenery-wall', 'sixth-tea-room']);
});
