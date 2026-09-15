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

test('影棚选择器保留正式站视觉语言', () => {
    assert.match(styles, /\.studio-venue-picker\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*3px;[\s\S]*?width:\s*112px;/);
    assert.match(styles, /\.studio-venue-floor-row\s*\{[\s\S]*?padding:\s*1px;[\s\S]*?border:\s*1px solid #F2F4F7;[\s\S]*?background:\s*#FAFBFC;/);
    assert.match(styles, /\.studio-venue-options\s*\{[\s\S]*?gap:\s*1px;/);
    assert.match(styles, /\.studio-venue-option[\s\S]*border-radius: var\(--radius-xs\)/);
    assert.match(styles, /\.studio-venue-floor-row \.studio-venue-option\.active\s*\{[\s\S]*?background:\s*#FFFFFF;[\s\S]*?color:\s*var\(--accent-ink\);[\s\S]*?box-shadow:\s*0 1px 1px rgba\(15, 23, 42, 0\.025\);/);
    assert.match(styles, /\.studio-venue-category-row \.studio-venue-option\.active\s*\{[\s\S]*?color:\s*var\(--accent-ink\);[\s\S]*?box-shadow:\s*inset 0 -2px 0 var\(--accent-solid\);/);
});
