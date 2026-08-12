const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const appSource = fs.readFileSync('app.js', 'utf8');
const layoutSource = fs.readFileSync('studio-layout.js', 'utf8');
const layoutStyles = fs.readFileSync('studio-layout.css', 'utf8');

test('6F 实景棚包含户型图中的 21 个可预约空间', () => {
    const expectedScenes = [
        '6F·走廊景', '6F·木墙景', '6F·绿植背景墙景',
        '6F·绿植房景', '6F·儿童房景', '6F·教室景', '6F·医护室景',
        '6F·海洋背景墙景',
        '6F·书房景', '6F·复古客厅景', '6F·复古餐厅景', '6F·现代客厅景',
        '6F·现代餐厅景', '6F·街道景', '6F·户外咖啡景', '6F·卧室景', '6F·洗浴室景',
        '6F·吧台景', '6F·国风景', '6F·工具间景', '6F·现代厨房景'
    ];

    for (const scene of expectedScenes) {
        assert.match(appSource, new RegExp(`id: '${scene}'`));
    }
    assert.equal(expectedScenes.length, 21);
});

test('6F 实景棚可以在楼层预览中展示', () => {
    assert.doesNotMatch(layoutSource, /6F暂无实景棚/);
    assert.doesNotMatch(layoutSource, /currentStudioFloor === '6F' && category === 'real-scene'/);
    assert.match(layoutSource, /preview-floor-map-sixth-floor/);
    assert.match(layoutStyles, /preview-floor-map-sixth-floor/);
});

test('6F 小屏预览保留横向户型图而不是降级为卡片列表', () => {
    assert.match(layoutStyles, /\.preview-content-6f\s*{[^}]*overflow-x:\s*auto/s);
    assert.match(layoutStyles, /\.preview-floor-map-sixth-floor\s*{[\s\S]*?min-width:\s*0;/);
});

test('6F 自由画布具备默认坐标、用户隔离存储和游客只读规则', () => {
    assert.match(layoutSource, /SIXTH_FLOOR_DEFAULT_LAYOUT/);
    assert.match(layoutSource, /studio-layout:6F:/);
    assert.match(layoutSource, /currentUser\.startsWith\('游客'\)/);
    assert.match(layoutSource, /data-layout-key/);
    assert.match(layoutSource, /resetSixthFloorLayout/);
    assert.match(layoutStyles, /sixth-floor-canvas/);
});

test('6F 自由画布不显示走廊和街道，并使用当前资源版本', () => {
    const htmlSource = fs.readFileSync('index.html', 'utf8');
    const serviceWorkerSource = fs.readFileSync('sw.js', 'utf8');

    assert.doesNotMatch(layoutSource, /走廊|街道|海洋背景墙/);
    assert.doesNotMatch(layoutStyles, /sixth-floor-corridor|sixth-floor-street/);
    assert.match(htmlSource, /studio-layout\.js\?v=20260812-preview-controls-v1/);
    assert.match(serviceWorkerSource, /studio-booking-v114-preview-controls/);
});

test('6F 自由画布在窄屏保持视口宽度并自动适配', () => {
    assert.match(layoutSource, /fitSixthFloorCanvasToViewport/);
    assert.match(layoutStyles, /\.preview-floor-map-sixth-floor\s*\{[\s\S]*?min-width:\s*0;/);
});

test('6F 户型图中的所有文字场景都作为可预约卡片', () => {
    const expectedSceneIds = [
        'sixth-corridor', 'sixth-wood-wall', 'sixth-greenery-wall', 'sixth-greenery',
        'sixth-kids', 'sixth-classroom', 'sixth-clinic', 'sixth-ocean-wall',
        'sixth-study', 'sixth-vintage-living', 'sixth-vintage-dining', 'sixth-modern-living',
        'sixth-modern-dining', 'sixth-street', 'sixth-outdoor-cafe', 'sixth-bedroom',
        'sixth-bathroom', 'sixth-bar', 'sixth-chinese', 'sixth-workshop', 'sixth-modern-kitchen'
    ];
    assert.equal(expectedSceneIds.length, 21);
    expectedSceneIds.forEach(sceneId => assert.match(appSource, new RegExp(`mapArea: '${sceneId}'`)));
    expectedSceneIds.forEach(sceneId => assert.match(layoutSource, new RegExp(`'${sceneId}'`)));
});

test('6F 场景结构变化后拒绝读取旧版个人布局', () => {
    assert.match(layoutSource, /SIXTH_FLOOR_LAYOUT_VERSION\s*=\s*3/);
    assert.match(layoutSource, /stored\?\.version === SIXTH_FLOOR_LAYOUT_VERSION/);
});

test('6F 卡片拖动时不会选中文字', () => {
    assert.match(layoutStyles, /\.sixth-floor-layout-card\s*\{[\s\S]*?user-select:\s*none;/);
});

test('6F 卡片使用高优先级绝对定位而不会落入普通文档流', () => {
    assert.match(layoutStyles, /\.preview-floor-map-sixth-floor\s+\.sixth-floor-layout-card\s*\{[\s\S]*?position:\s*absolute;/);
});

test('6F 默认布局按参考图分成左中右三段户型区域', () => {
    assert.match(layoutSource, /SIXTH_FLOOR_LAYOUT_VERSION\s*=\s*3/);
    assert.match(layoutSource, /'sixth-greenery':\s*\{\s*x:\s*40,\s*y:\s*170,\s*width:\s*200,\s*height:\s*500/);
    assert.match(layoutSource, /'sixth-study':\s*\{\s*x:\s*840,\s*y:\s*170/);
    assert.match(layoutSource, /'sixth-vintage-dining':\s*\{\s*x:\s*1440,\s*y:\s*170/);
});

test('6F 已保存和拖动中的卡片坐标都会被限制在画布内', () => {
    assert.match(layoutSource, /function clampSixthFloorCardPosition/);
    assert.match(layoutSource, /Math\.min\(SIXTH_FLOOR_CANVAS_SIZE\.width - card\.width/);
    assert.match(layoutSource, /clampSixthFloorLayout/);
    assert.match(layoutSource, /clampSixthFloorCardPosition\(\{[\s\S]*\.\.\.next/);
});

test('6F 拖动后的点击抑制标记会自动清理', () => {
    assert.match(layoutSource, /setTimeout\(\(\) => \{\s*sixthFloorSuppressClick = false;/);
    assert.match(layoutSource, /pointercancel/);
});

test('楼层和影棚类型切换控件固定在预览卡片右上角', () => {
    assert.match(layoutSource, /preview-card-controls/);
    assert.match(layoutSource, /preview-card-tabs-grid/);
    assert.match(layoutStyles, /\.preview-card-controls\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*12px;[\s\S]*?right:\s*12px;[\s\S]*?display:\s*grid;/);
    assert.match(layoutStyles, /\.preview-card-tabs-grid\s*\{[\s\S]*?display:\s*flex;[\s\S]*?gap:\s*12px;/);
    assert.match(layoutStyles, /\.preview-card-with-controls\s*\{[\s\S]*?position:\s*relative;/);
});
