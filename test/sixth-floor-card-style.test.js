const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync('studio-layout.js', 'utf8');
const styles = fs.readFileSync('studio-layout.css', 'utf8');

const CARD = String.raw`\.preview-floor-map-sixth-floor \.sixth-floor-layout-card\.preview-scene-card`;

function rule(selector) {
    return styles.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`));
}

test('6F 卡面统一成同一套透明毛玻璃，不再按景着色', () => {
    const glass = rule(CARD);
    assert.ok(glass, '没有找到 6F 卡面规则');
    assert.match(glass[1], /linear-gradient\(/, '卡面应是一层渐变');
    assert.match(glass[1], /backdrop-filter:\s*blur\(\d+px\)/,
        '毛玻璃必须靠 backdrop-filter 把背后的画布糊开');

    const bg = glass[1].match(/background:([\s\S]*?);/);
    assert.ok(bg, '没有找到 6F 卡面背景');

    // 22 张卡共用这一套配方。卡面里只允许出现 --state-wash 一个变量——
    // 出现别的 var() 就意味着又能按景漂移，摆在一起又会花。
    const vars = [...new Set([...bg[1].matchAll(/var\((--[a-z0-9-]+)/g)].map(match => match[1]))];
    assert.deepEqual(vars, ['--state-wash'],
        `卡面只能引用 --state-wash 叠状态色，实际引用了 ${vars.join(', ') || '（无）'}`);

    // "透明"是这版的关键：全不透明的白卡模糊前后一模一样，等于没有玻璃。
    // 所以玻璃本体的每一档都必须是半透明，且至少两档才是渐变。
    const stops = [...bg[1].matchAll(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/g)]
        .map(match => ({ rgb: [1, 2, 3].map(i => Number(match[i])), alpha: Number(match[4]) }));
    assert.ok(stops.length >= 2, `玻璃渐变至少要有两档，实际 ${stops.length}`);
    for (const { rgb, alpha } of stops) {
        assert.ok(alpha > 0 && alpha < 1,
            `玻璃每一档都要半透明（0 < alpha < 1），实际 alpha=${alpha}`);
        // 近白冷色：保持参考图那种干净的冷灰，别退回暖黄或深灰。
        assert.ok(Math.min(...rgb) >= 225, `玻璃色 rgb(${rgb}) 太暗，卡面会显脏`);
        assert.ok(rgb[2] >= rgb[0], `玻璃色 rgb(${rgb}) 应偏冷（蓝 >= 红）`);
    }

    // 按景的身份色整体退场，不留半截定义。
    assert.doesNotMatch(styles, /--scene-tint\s*:/, '按景身份色的定义应已整体移除');

    // 色斑铺满整卡之后，原来的"右下角一团柔光"必须撤掉，否则两层色会发脏。
    assert.doesNotMatch(styles, /radial-gradient\(\s*128% 140%/);
});

test('毛玻璃配方对 22 张卡一视同仁，状态靠 --state-wash 叠色而不是换卡面', () => {
    // 玻璃只有一份配方，写在"不带状态类"的选择器上，四种状态共用。
    // 状态若各自另写 background，卡面质感就分裂成四种，摆在一起会乱。
    assert.ok(rule(CARD), '玻璃配方应写在所有 6F 卡片上');

    for (const state of ['partial', 'full', 'ended']) {
        const stateRule = rule(String.raw`${CARD}\.${state}`);
        assert.ok(stateRule, `${state} 应有自己的状态色规则`);
        assert.match(stateRule[1], /--state-wash:\s*rgba\(/,
            `${state} 应通过 --state-wash 叠一层状态色`);
        assert.doesNotMatch(stateRule[1], /background:/,
            `${state} 不该另写卡面背景，否则会盖掉毛玻璃`);
    }

    // 可预约 = 不叠色，玻璃原样透出来（基类的 --state-wash 是全透明的）。
    // 锚 ^：不锚的话会先匹配到 `.preview-floor-map-sixth-floor .preview-scene-card {`，
    // 那是画布规则不是基类。
    const base = styles.match(/^\.preview-scene-card\s*\{([\s\S]*?)\n\}/m);
    assert.ok(base, '没有找到卡片基类规则');
    assert.match(base[1], /--state-wash:\s*rgba\(\s*255,\s*255,\s*255,\s*0\s*\)/,
        '可预约卡不应叠任何状态色，否则玻璃会被染上一层底灰');

    // 状态之间必须有层次。已约满要明确比另外两种更重，否则三张卡看着一样。
    const washAlpha = state => {
        const found = rule(String.raw`${CARD}\.${state}`)[1]
            .match(/--state-wash:\s*rgba\([^)]*?([\d.]+)\s*\)/);
        return found ? Number(found[1]) : NaN;
    };
    const partial = washAlpha('partial');
    const full = washAlpha('full');
    const ended = washAlpha('ended');
    assert.ok(full > partial, `已约满(${full})应比部分预约(${partial})更重`);
    assert.ok(full > ended, `已约满(${full})应比已过期(${ended})更重`);
    assert.ok(partial > 0 && ended > 0, '部分预约和已过期都要有可见的状态色');
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
