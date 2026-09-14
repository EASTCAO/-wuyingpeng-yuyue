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

test('6F 文字排版复刻参考图：标题沉到左下角，下面跟细分隔线和小字标签', () => {
    const card = rule(CARD);
    assert.ok(card, '没有找到 6F 卡片排版规则');
    assert.match(card[1], /justify-content:\s*flex-end/);
    assert.match(card[1], /align-items:\s*flex-start/);
    assert.match(card[1], /text-align:\s*left/);

    const top = rule(String.raw`${CARD} \.preview-scene-card-top`);
    assert.ok(top, '没有找到 6F 标题块规则');
    assert.match(top[1], /order:\s*2/);
    assert.match(top[1], /height:\s*auto/);
    assert.match(top[1], /justify-content:\s*flex-start/);

    const code = rule(String.raw`${CARD} \.preview-scene-code`);
    assert.ok(code, '没有找到 6F 小字标签规则');
    assert.match(code[1], /order:\s*3/);
    assert.match(code[1], /border-top:\s*1px solid/);
    assert.match(code[1], /letter-spacing:/);
    assert.match(code[1], /text-align:\s*left/);

    // 有预约时进度条排在标题之上，底边仍由标题块收口。
    const progress = rule(String.raw`${CARD} \.preview-scene-progress`);
    assert.ok(progress, '没有找到 6F 进度条排版规则');
    assert.match(progress[1], /order:\s*1/);
});

test('6F 卡片只留文字标签，不带编号', () => {
    // 标签是纯装饰（编号已按用户要求去掉），所以 aria-hidden，读屏只念景名。
    assert.match(source, /position \? '<p class="preview-scene-code" aria-hidden="true">SCENE<\/p>' : ''/);
    assert.doesNotMatch(source, /preview-scene-code[^>]*>[^<]*\d/);
    // 7F 走同一套卡片渲染，不能跟着多出这个标签。
    assert.match(source, /const verticalTitle = Boolean\(position/);
});
