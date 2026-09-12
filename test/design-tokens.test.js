// 设计 token 的结构性校验。
//
// 建立 token 层时踩过两次同一个坑：全局替换 hex 时把 :root 里的定义本身也替换了，
// 产生 `--accent: var(--accent)` 这种循环引用。CSS 里它解析为空值，
// 等于全站悄悄失去该颜色，浏览器不会报任何错。这里把它变成硬失败。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const styleFiles = ['style.css', 'studio-layout.css'];
const styles = styleFiles.map(file => fs.readFileSync(path.join(projectRoot, file), 'utf8'));
const pageStyles = styles[0];

// studio-layout.css 里这些是局部作用域变量（定义在具体选择器上，不在 :root）
const SCOPED_VARIABLES = new Set([
    '--card-border', '--card-edge', '--card-shadow', '--card-depth',
    '--card-hover-depth', '--card-shadow-y', '--card-shadow-blur',
    '--scene-base', '--scene-tint', '--state-wash', '--preview-index',
    '--cover-scrim', '--cover-border', '--cover-wash',
    '--card-x', '--card-y', '--card-width', '--card-height', '--scene-index'
]);

function tokenValue(name) {
    for (const line of pageStyles.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(`${name}:`)) continue;
        const value = trimmed.slice(name.length + 1).split(';')[0].trim();
        return value;
    }
    return null;
}

function contrast(hexA, hexB) {
    const toRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const luminance = rgb => {
        const channel = v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
    };
    const [high, low] = [luminance(toRgb(hexA)), luminance(toRgb(hexB))].sort((a, b) => b - a);
    return (high + 0.05) / (low + 0.05);
}

test('token 定义不能循环引用自身', () => {
    for (const [index, css] of styles.entries()) {
        const circular = [...css.matchAll(/(--[a-z0-9-]+)\s*:\s*var\(\s*\1\s*\)/g)].map(m => m[1]);
        assert.deepEqual(circular, [], `${styleFiles[index]} 里循环引用的 token: ${circular.join(', ')}`);
    }
});

test('所有被引用的 token 都有定义', () => {
    const declared = new Set(
        [...pageStyles.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map(m => m[1])
    );
    const used = new Set(
        styles.flatMap(css => [...css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map(m => m[1]))
    );
    const missing = [...used].filter(name => !declared.has(name) && !SCOPED_VARIABLES.has(name));
    assert.deepEqual(missing, [], `未定义的 token: ${missing.join(', ')}`);
});

test('承载白字的填充色必须达到 WCAG AA 4.5:1', () => {
    for (const name of ['--accent-solid', '--danger-solid']) {
        const value = tokenValue(name);
        assert.ok(value, `找不到 ${name} 的定义`);
        assert.match(value, /^#[0-9A-Fa-f]{6}$/, `${name} 应为字面色值，实际是 ${value}`);
        const ratio = contrast('#FFFFFF', value);
        assert.ok(ratio >= 4.5, `${name} (${value}) 白字对比度只有 ${ratio.toFixed(2)}，需 >= 4.5`);
    }
});

test('主色只做图形和边框，按 3:1 图形标准', () => {
    // #4C7DFF 对白是 3.69:1：够做图形（开关、勾选框、边框），
    // 但不够做正文，也不能承载白字——那些场景必须走 --accent-solid。
    const value = tokenValue('--accent');
    assert.match(value, /^#[0-9A-Fa-f]{6}$/);
    const ratio = contrast('#FFFFFF', value);
    assert.ok(ratio >= 3, `--accent (${value}) 图形对比度只有 ${ratio.toFixed(2)}，需 >= 3`);
    assert.ok(ratio < 4.5, `--accent 已达到 4.5，可以合并掉 --accent-solid 了`);
});

test('样式表里不再有裸露的强调色和纯黑', () => {
    for (const [index, css] of styles.entries()) {
        const body = index === 0 ? css.slice(css.indexOf('}', css.indexOf(':root'))) : css;
        for (const literal of ['#4C7DFF', '#2563EB', '#1D4ED8', '#EF4444', '#DC2626', '#000000']) {
            assert.ok(
                !body.includes(literal),
                `${styleFiles[index]} 里还有裸露的 ${literal}，应改用 token`
            );
        }
    }
});

test('样式表花括号必须配平', () => {
    // 多一个 } 会让它之后的所有规则静默失效——浏览器不报错，
    // 表现是"某条样式莫名其妙不生效"，极难排查。这里变成硬失败。
    for (const [index, css] of styles.entries()) {
        const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
        let depth = 0;
        let line = 1;
        for (let i = 0; i < source.length; i += 1) {
            if (source[i] === '\n') line += 1;
            else if (source[i] === '{') depth += 1;
            else if (source[i] === '}') {
                depth -= 1;
                assert.ok(depth >= 0, `${styleFiles[index]}:${line} 有多余的 }，它之后的规则会全部失效`);
            }
        }
        assert.equal(depth, 0, `${styleFiles[index]} 有 ${depth} 个未闭合的 {`);
    }
});

test('圆角全部走 token，不留裸 px', () => {
    for (const [index, css] of styles.entries()) {
        const bare = [...css.matchAll(/border-radius:\s*(\d+px)/g)].map(m => m[1]);
        assert.deepEqual(bare, [], `${styleFiles[index]} 里还有裸圆角: ${bare.join(', ')}`);
    }
});

test('全屏高度使用 100dvh 并保留 100vh 回退', () => {
    for (const [index, css] of styles.entries()) {
        const lines = css.split('\n');
        lines.forEach((line, i) => {
            if (!/(?:min-height|max-height|height):[^;]*100vh/.test(line)) return;
            const next = lines[i + 1] || '';
            assert.match(
                next,
                /100dvh/,
                `${styleFiles[index]}:${i + 1} 的 100vh 后面必须紧跟 100dvh 覆盖行`
            );
        });
    }
});
