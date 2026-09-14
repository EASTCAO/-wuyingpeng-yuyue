const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync('studio-layout.js', 'utf8');
const styles = fs.readFileSync('studio-layout.css', 'utf8');

const CARD = String.raw`\.preview-floor-map-sixth-floor \.sixth-floor-layout-card\.preview-scene-card`;

function rule(selector) {
    return styles.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`));
}

// 把 background 拆成一层层渐变。卡面是叠出来的（状态色 / 高光 / 玻璃本体 / 颗粒），
// 正则一把梭会把高光那层的透明端点当成"玻璃的一档"，量出错误的透过率。
function gradientLayers(declaration) {
    const layers = [];
    const opener = /(?:linear|radial)-gradient\(/g;
    let match;
    while ((match = opener.exec(declaration))) {
        let depth = 1;
        let i = opener.lastIndex;
        for (; i < declaration.length && depth > 0; i++) {
            if (declaration[i] === '(') depth++;
            else if (declaration[i] === ')') depth--;
        }
        layers.push(declaration.slice(opener.lastIndex, i - 1));
        opener.lastIndex = i;
    }
    return layers;
}

function rgbaStops(layer) {
    return [...layer.matchAll(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/g)]
        .map(match => ({ rgb: [1, 2, 3].map(i => Number(match[i])), alpha: Number(match[4]) }));
}

// 玻璃本体 = 唯一那一层"每一档都半透明"的渐变。
// 高光层必然有一档是全透明的（它得淡出），据此把两者分开。
function glassBody(cardRule) {
    const bg = cardRule[1].match(/background:([\s\S]*?);/);
    assert.ok(bg, '没有找到卡面背景');
    const bodies = gradientLayers(bg[1])
        .map(rgbaStops)
        .filter(stops => stops.length >= 2 && stops.every(s => s.alpha > 0 && s.alpha < 1));
    assert.equal(bodies.length, 1,
        `应当正好有一层"每档都半透明"的玻璃本体，实际 ${bodies.length} 层`);
    return bodies[0];
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
    const stops = glassBody(glass);
    for (const { rgb, alpha } of stops) {
        // 近白冷色：保持参考图那种干净的冷灰，别退回暖黄或深灰。
        assert.ok(Math.min(...rgb) >= 225, `玻璃色 rgb(${rgb}) 太暗，卡面会显脏`);
        assert.ok(rgb[2] >= rgb[0], `玻璃色 rgb(${rgb}) 应偏冷（蓝 >= 红）`);
        assert.ok(alpha > 0 && alpha < 1,
            `玻璃每一档都要半透明（0 < alpha < 1），实际 alpha=${alpha}`);
    }

    // 高光扫过：玻璃最强的识别线索，缺了它就只是"一张更白的卡"。
    const sheens = gradientLayers(bg[1]).filter(layer => /rgba\(\s*255,\s*255,\s*255,\s*0(?:\.0+)?\s*\)/.test(layer));
    assert.ok(sheens.length >= 1, '卡面应有一层从亮到全透明的高光扫过');

    // 按景的身份色整体退场，不留半截定义。
    assert.doesNotMatch(styles, /--scene-tint\s*:/, '按景身份色的定义应已整体移除');

    // 色斑铺满整卡之后，原来的"右下角一团柔光"必须撤掉，否则两层色会发脏。
    assert.doesNotMatch(styles, /radial-gradient\(\s*128% 140%/);
});

test('毛玻璃卡面必须明显亮于画布，否则卡片会溶进背景', () => {
    // 半透明卡在平涂画布上面临一个硬约束：alpha 越低，合成出来的颜色越接近画布。
    // 低到一定程度，卡片就只剩一圈边框、右下角直接和背景连成一片——那就不像卡片了。
    // 这条把"卡片最暗处仍要明显亮于画布"钉住，避免以后为了"更透"把卡片调没。
    const canvas = styles.match(
        /\.studio-booking-page \.list-view\.real-scene-active,\s*\n\.sixth-floor-canvas-viewport\s*\{\s*\n\s*background:\s*(#[0-9A-Fa-f]{6})/
    );
    assert.ok(canvas, '没有找到 6F 画布底色');
    const backdrop = [1, 3, 5].map(i => parseInt(canvas[1].slice(i, i + 2), 16));

    // 只算"玻璃本体"那几档的合成：高光扫过和颗粒不改本体的透过率下限。
    const stops = glassBody(rule(CARD));
    const composites = stops.map(({ rgb, alpha }) =>
        rgb.map((channel, i) => channel * alpha + backdrop[i] * (1 - alpha)));

    // 用标准的相对亮度（含 sRGB 传递函数），结果落在 0~1。
    // 别用 0~255 的加权和当亮度：那不是亮度，算出来的差值也没有可解释的量纲。
    const channel = v => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const luminance = rgb => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);

    const darkest = composites.reduce((a, b) => (luminance(a) <= luminance(b) ? a : b));
    const gap = luminance(darkest) - luminance(backdrop);

    // 下限 0.04：当前设计的最透一档仍明显高于画布，说明这个下限卡得住
    // 又不过分——再往下调玻璃就会溶进画布（alpha 0.3 时只剩约 0.024，会被拦下）。
    // 卡片另有边框和棱光帮忙定形，所以这里不需要很高的差值。
    assert.ok(gap >= 0.04,
        `卡面最暗处 rgb(${darkest.map(v => v.toFixed(0))}) 只比画布亮 ${gap.toFixed(3)}（相对亮度），` +
        '再透就会溶进背景、只剩一圈边框');
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
