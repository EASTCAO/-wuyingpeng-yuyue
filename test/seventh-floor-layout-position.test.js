const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

test('7F 实景棚在桌面端垂直居中，6F 保持原有填充布局', () => {
    const css = fs.readFileSync('studio-layout.css', 'utf8');
    const rule = css.match(/\.studio-booking-page \.list-view\.real-scene-active \.preview-workspace-7f\s*\{([^}]+)\}/);
    assert.ok(rule, '缺少 7F 工作区定位规则');
    assert.match(rule[1], /display:\s*flex/);
    assert.match(rule[1], /justify-content:\s*center/);
    assert.match(css, /\.preview-workspace-7f \.preview-content\s*\{[^}]*flex:\s*0 1 auto/s);
});
