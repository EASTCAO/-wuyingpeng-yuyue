const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

test('桌面端实景棚状态图例下移到 8px', () => {
    const css = fs.readFileSync('studio-layout.css', 'utf8');
    const rule = css.match(/\.studio-booking-page \.list-view\.real-scene-active \.preview-status-legend\s*\{([^}]+)\}/);
    assert.ok(rule);
    assert.match(rule[1], /top:\s*8px;/);
    assert.match(rule[1], /right:\s*0;/);
});
