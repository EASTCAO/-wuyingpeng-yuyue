const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const appSource = fs.readFileSync('app.js', 'utf8');
const layoutSource = fs.readFileSync('studio-layout.js', 'utf8');
const layoutStyles = fs.readFileSync('studio-layout.css', 'utf8');

test('6F 实景棚包含户型图中的 16 个可预约空间', () => {
    const expectedScenes = [
        '6F·绿植房景', '6F·儿童房景', '6F·教室景', '6F·医护室景',
        '6F·书房景', '6F·复古客厅景', '6F·复古餐厅景', '6F·现代客厅景',
        '6F·现代餐厅景', '6F·户外咖啡景', '6F·卧室景', '6F·洗浴室景',
        '6F·吧台景', '6F·国风景', '6F·工具间景', '6F·现代厨房景'
    ];

    for (const scene of expectedScenes) {
        assert.match(appSource, new RegExp(`id: '${scene}'`));
    }
});

test('6F 实景棚可以在楼层预览中展示', () => {
    assert.doesNotMatch(layoutSource, /6F暂无实景棚/);
    assert.doesNotMatch(layoutSource, /currentStudioFloor === '6F' && category === 'real-scene'/);
    assert.match(layoutSource, /preview-floor-map-sixth-floor/);
    assert.match(layoutStyles, /preview-floor-map-sixth-floor/);
});

test('6F 小屏预览保留横向户型图而不是降级为卡片列表', () => {
    assert.match(layoutStyles, /\.preview-content-6f\s*{[^}]*overflow-x:\s*auto/s);
    assert.match(layoutStyles, /\.preview-floor-map-sixth-floor\s*{[^}]*grid-template-columns:\s*repeat\(24/s);
    assert.match(layoutStyles, /\.preview-floor-map-sixth-floor\s*{[^}]*min-width:\s*1180px/s);
});

test('6F 自由画布具备默认坐标、用户隔离存储和游客只读规则', () => {
    assert.match(layoutSource, /SIXTH_FLOOR_DEFAULT_LAYOUT/);
    assert.match(layoutSource, /studio-layout:6F:/);
    assert.match(layoutSource, /currentUser\.startsWith\('游客'\)/);
    assert.match(layoutSource, /data-layout-key/);
    assert.match(layoutSource, /resetSixthFloorLayout/);
    assert.match(layoutStyles, /sixth-floor-canvas/);
});
