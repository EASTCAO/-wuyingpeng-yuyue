const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync('studio-layout.js', 'utf8');
const styles = fs.readFileSync('studio-layout.css', 'utf8');

const CARD = String.raw`\.preview-floor-map-sixth-floor \.sixth-floor-layout-card\.preview-scene-card`;

function rule(selector) {
    return styles.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`));
}

test('6F 卡面配色复刻参考图：整卡从白渐变到身份色', () => {
    const available = rule(String.raw`${CARD}\.available`);
    assert.ok(available, '没有找到 6F 可用卡片的卡面渐变规则');
    assert.match(available[1], /linear-gradient\(/);
    assert.match(available[1], /var\(--scene-tint\)/);

    // 参考图的色很淡：身份色必须往白里调掉七八成，深色版会压过景名。
    const whites = [...available[1].matchAll(/var\(--scene-tint\), #FFFFFF (\d+)%/g)].map(match => Number(match[1]));
    assert.equal(whites.length, 2, '渐变应有中间和末端两档身份色');
    for (const white of whites) {
        assert.ok(white >= 65, `身份色往白里调的比例应 >=65%，实际 ${white}%`);
    }

    // 身份色铺满整卡之后，原来的"右下角一团色斑"必须撤掉，否则两层色会发脏。
    assert.doesNotMatch(styles, /radial-gradient\(\s*128% 140%/);
});

test('卡面身份色只作用于可预约卡片，不会盖掉预约状态色', () => {
    // 渐变若写给不带状态类的卡片，特指度会高过 .partial / .full 的状态底色。
    assert.ok(rule(String.raw`${CARD}\.available`), '身份色渐变必须限定在 .available 上');
    assert.doesNotMatch(
        styles,
        new RegExp(String.raw`${CARD}\s*\{[^}]*background:\s*linear-gradient\(163deg`)
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
