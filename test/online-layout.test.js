const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const styles = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const studioStyles = fs.readFileSync(path.join(root, 'studio-layout.css'), 'utf8');

test('全局界面不再加载 Apple 风格覆盖层', () => {
    assert.doesNotMatch(styles, /Apple-inspired utility UI/);
    assert.doesNotMatch(styles, /Apple-style interaction and layout refinement pass/);
    assert.doesNotMatch(studioStyles, /Apple-inspired product-surface refinements/);
});

test('登录页走设计系统而不是散落的字面值', () => {
    // 不再钉死具体 px：token 层建立后，该断言的是"用了哪个 token"，
    // 而不是"这个值是多少"——否则每次调尺寸都要改测试。
    const block = name => {
        const start = styles.indexOf(`${name} {`);
        assert.notEqual(start, -1, `找不到 ${name}`);
        return styles.slice(start, styles.indexOf('}', start));
    };

    for (const name of ['.login-card', '.login-form input', '.login-btn', '.guest-btn']) {
        assert.match(block(name), /border-radius: var\(--radius-/, `${name} 圆角必须走 token`);
    }
    // 卡片和输入框用 Cal.com 的阴影体系，输入框靠 ring 而非 border 围合
    assert.match(block('.login-card'), /box-shadow: var\(--shadow-/);
    assert.match(block('.login-form input'), /box-shadow: var\(--shadow-ring\)/);
    assert.match(block('.guest-btn'), /box-shadow: var\(--shadow-ring\)/);

    // 主按钮是 Cal.com 的 Dark Primary，不是强调蓝
    assert.match(block('.login-btn'), /background: var\(--ink\)/);
    assert.doesNotMatch(block('.login-btn'), /var\(--accent/);

    // 触控目标不小于 44px
    for (const name of ['.login-btn', '.guest-btn']) {
        const m = block(name).match(/min-height: (\d+)px/);
        assert.ok(m && Number(m[1]) >= 44, `${name} 触控高度应 >= 44px`);
    }
});

test('新增影棚四选一控件保留正式站视觉语言', () => {
    assert.match(styles, /\.studio-view-tabs[\s\S]*grid-template-columns: repeat\(4/);
    assert.match(styles, /\.studio-view-tab[\s\S]*border-radius: var\(--radius-xs\)/);
    assert.match(styles, /\.studio-view-tab\.active[\s\S]*background: var\(--accent-solid\)/);
});
