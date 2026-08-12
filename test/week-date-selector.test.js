const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const htmlSource = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const styleSource = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(projectRoot, 'sw.js'), 'utf8');
const dateUtils = require('../week-date-selector.js');

test('日期所在周按周一到周日连续生成 7 天', () => {
    assert.deepEqual(dateUtils.getWeekDates('2026-08-12'), [
        '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13',
        '2026-08-14', '2026-08-15', '2026-08-16'
    ]);
});

test('前后切周每次移动 7 天并正确跨月', () => {
    assert.equal(dateUtils.shiftDate('2026-08-03', -7), '2026-07-27');
    assert.equal(dateUtils.shiftDate('2026-08-31', 7), '2026-09-07');
});

test('顶部工具栏使用每周日期选择器结构', () => {
    assert.match(htmlSource, /id="weekDateSelector"/);
    assert.match(htmlSource, /data-week-direction="previous"/);
    assert.match(htmlSource, /data-week-direction="next"/);
    assert.match(styleSource, /\.week-date-list/);
    assert.match(styleSource, /\.week-date-item\.active/);
    assert.match(htmlSource, /week-date-selector\.js\?v=20260812-week-date-v1/);
    assert.match(serviceWorkerSource, /studio-booking-v116-status-legend/);
    assert.doesNotMatch(htmlSource, /<button class="view-btn active" onclick="switchView\('list'\)">大厅<\/button>/);
});
