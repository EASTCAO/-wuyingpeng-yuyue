const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

test('洗衣房标题移除卡片底，不影响进度条', () => {
    const css = fs.readFileSync('studio-layout.css', 'utf8');
    const rule = css.match(/([^{}]*has-progress\[data-map-area="service-laundry"\] h4)\s*\{([^}]+)\}/);
    assert.ok(rule);
    assert.doesNotMatch(rule[1], /preview-scene-progress/);
    for (const property of ['border: none', 'border-radius: 0', 'background: transparent', 'box-shadow: none']) {
        assert.ok(rule[2].includes(property), property);
    }
});

test('洗衣房卡片只显示洗衣房，不显示景别第二行', () => {
    const source = fs.readFileSync('studio-layout.js', 'utf8');
    const start = source.indexOf('const STUDIO_SCENE_TITLE_LINES =');
    const end = source.indexOf('const SIXTH_FLOOR_CANVAS_SIZE', start);
    const html = vm.runInNewContext(
        `${source.slice(start, end)}\nrenderStudioSceneTitle('洗衣房景别');`,
        { escapeHtml: value => value }
    );

    assert.equal((html.match(/class="preview-scene-title-line"/g) || []).length, 1);
    assert.match(html, />洗衣房<\/span>/);
    assert.doesNotMatch(html, />景别<\/span>/);
});
