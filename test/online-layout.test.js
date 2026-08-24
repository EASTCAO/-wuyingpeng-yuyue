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

test('登录页保持正式站的卡片和按钮尺寸', () => {
    assert.match(styles, /\.login-card\s*\{[\s\S]*?padding: 30px;[\s\S]*?border-radius: var\(--radius-lg\);[\s\S]*?box-shadow: var\(--shadow-raised\)/);
    assert.match(styles, /\.login-form input\s*\{[\s\S]*?padding: 10px 12px 10px 36px;[\s\S]*?border-radius: var\(--radius-md\);/);
    assert.match(styles, /\.login-btn\s*\{[\s\S]*?min-height: 42px;[\s\S]*?border-radius: var\(--radius-md\);/);
    assert.match(styles, /\.guest-btn\s*\{[\s\S]*?min-height: 42px;[\s\S]*?border-radius: var\(--radius-md\);/);
});

test('新增影棚四选一控件保留正式站视觉语言', () => {
    assert.match(styles, /\.studio-view-tabs[\s\S]*grid-template-columns: repeat\(4/);
    assert.match(styles, /\.studio-view-tab[\s\S]*border-radius: var\(--radius-xs\)/);
    assert.match(styles, /\.studio-view-tab\.active[\s\S]*background: var\(--accent-solid\)/);
});
