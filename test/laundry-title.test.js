const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

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
