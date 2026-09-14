const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync('studio-layout.js', 'utf8');
const styles = fs.readFileSync('studio-layout.css', 'utf8');

const CARD = String.raw`\.preview-floor-map-sixth-floor \.sixth-floor-layout-card\.preview-scene-card`;

function rule(selector) {
    return styles.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`));
}

test('6F 卡面统一成参考图的近白冷渐变，不再按景着色', () => {
    const available = rule(String.raw`${CARD}\.available`);
    assert.ok(available, '没有找到 6F 可用卡片的卡面渐变规则');
    assert.match(available[1], /linear-gradient\(/);

    // 参考图里 22 张卡是同一个颜色。任何"按景变化"的变量都会让卡面重新
    // 深浅不一，所以卡面上只允许出现字面色值。
    assert.doesNotMatch(available[1], /var\(--/, '卡面不能再依赖按景变量，否则又会花');

    const stops = [...available[1].matchAll(/#([0-9A-Fa-f]{6})/g)].map(match => match[1]);
    assert.ok(stops.length >= 2, `卡面渐变至少要有两档颜色，实际 ${stops.length}`);
    for (const hex of stops) {
        const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
        // 近白：最暗的一档也要足够亮，否则一群卡摆在一起还是显花。
        assert.ok(Math.min(r, g, b) >= 235, `卡面色 #${hex} 不够浅`);
        // 冷调：蓝分量不低于红分量，才是参考图那种干净的冷灰而不是发黄。
        assert.ok(b >= r, `卡面色 #${hex} 应偏冷（蓝 >= 红）`);
    }

    // 按景的身份色整体退场，不留半截定义。
    assert.doesNotMatch(styles, /--scene-tint\s*:/, '按景身份色的定义应已整体移除');

    // 色斑铺满整卡之后，原来的"右下角一团柔光"必须撤掉，否则两层色会发脏。
    assert.doesNotMatch(styles, /radial-gradient\(\s*128% 140%/);
});

test('统一卡面只作用于可预约卡片，不会盖掉预约状态色', () => {
    // 渐变若写给不带状态类的卡片，特指度会高过 .partial / .full 的状态底色。
    assert.ok(rule(String.raw`${CARD}\.available`), '统一卡面渐变必须限定在 .available 上');
    // 按色值认，不按角度认：改角度不该让这条失效。
    assert.doesNotMatch(
        styles,
        new RegExp(String.raw`${CARD}\s*\{[^}]*background:\s*linear-gradient\([^;]*#FCFCFD`),
        '统一卡面不能写给不带状态类的卡片，否则会盖掉 .partial / .full 的状态底色'
    );
    for (const state of ['partial', 'full', 'ended']) {
        assert.match(
            styles,
            new RegExp(String.raw`\.preview-scene-card\.${state}\s*\{[\s\S]*?background:\s*linear-gradient`),
            `${state} 的状态底色不能丢`
        );
    }
});

test('6F 文字排版保持居中，不再改成左下角', () => {
    // 参考图的左下角标题块已被用户否掉，这里锁住旧版：标题居中、无分隔线、无标签。
    assert.doesNotMatch(styles, new RegExp(String.raw`${CARD}\s*\{[^}]*justify-content:\s*flex-end`));
    assert.doesNotMatch(styles, /preview-scene-code/);
    assert.doesNotMatch(styles, /border-top:\s*1px solid rgba\(37, 43, 51/);

    // 卡片本身仍由基类的居中规则排版。
    assert.match(styles, /\.preview-scene-card\s*\{[\s\S]*?justify-content:\s*center/);
    assert.match(styles, /\.preview-scene-card h4\s*\{[\s\S]*?text-align:\s*center/);
});

test('6F 卡片不带编号，也不带装饰标签', () => {
    assert.doesNotMatch(source, /preview-scene-code|SCENE \//);
    assert.doesNotMatch(source, /preview-scene-number/);
    // 7F 走同一套卡片渲染，同样不能多出编号。
    assert.doesNotMatch(source, /class="[^"]*preview-scene-(code|number)/);
});
