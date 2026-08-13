const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const appSource = fs.readFileSync('app.js', 'utf8');
const layoutSource = fs.readFileSync('studio-layout.js', 'utf8');
const layoutStyles = fs.readFileSync('studio-layout.css', 'utf8');
const pageStyles = fs.readFileSync('style.css', 'utf8');

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
    assert.match(htmlSource, /studio-layout\.js\?v=[^"']+/);
    assert.match(serviceWorkerSource, /'\.\/studio-layout\.js'/);
});

test('6F 自由画布在窄屏保持视口宽度并自动适配', () => {
    assert.match(layoutSource, /fitSixthFloorCanvasToViewport/);
    assert.match(layoutStyles, /\.preview-floor-map-sixth-floor\s*\{[\s\S]*?min-width:\s*0;/);
});

test('6F 自由画布在桌面端占满剩余高度并展示全部卡片', () => {
    assert.match(layoutStyles, /\.studio-booking-page \.list-view\.real-scene-active\s*\{[\s\S]*?overflow:\s*hidden;/);
    assert.match(layoutStyles, /\.studio-booking-page \.list-view\.real-scene-active \.preview-content-6f\s*\{[\s\S]*?flex:\s*1;[\s\S]*?min-height:\s*0;/);
    assert.match(layoutStyles, /\.preview-floor-map-sixth-floor\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;/);
});

test('6F 自由画布在移动端保留横向户型图比例', () => {
    assert.match(layoutStyles, /@media \(max-width:\s*768px\)[\s\S]*?\.preview-floor-map-sixth-floor\s*\{[\s\S]*?height:\s*auto;[\s\S]*?min-height:\s*540px;[\s\S]*?aspect-ratio:\s*2\s*\/\s*1;/);
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
    assert.match(layoutSource, /SIXTH_FLOOR_LAYOUT_VERSION\s*=\s*4/);
    assert.match(layoutSource, /stored\?\.version === SIXTH_FLOOR_LAYOUT_VERSION/);
});

test('6F 卡片拖动时不会选中文字', () => {
    assert.match(layoutStyles, /\.sixth-floor-layout-card\s*\{[\s\S]*?user-select:\s*none;/);
});

test('6F 卡片使用高优先级绝对定位而不会落入普通文档流', () => {
    assert.match(layoutStyles, /\.preview-floor-map-sixth-floor\s+\.sixth-floor-layout-card\s*\{[\s\S]*?position:\s*absolute;/);
});

test('6F 默认布局按参考图分成左中右三段户型区域', () => {
    assert.match(layoutSource, /SIXTH_FLOOR_LAYOUT_VERSION\s*=\s*4/);
    assert.match(layoutSource, /SIXTH_FLOOR_CANVAS_SIZE\s*=\s*\{\s*width:\s*1800,\s*height:\s*1040\s*\}/);
    assert.match(layoutSource, /'sixth-greenery':\s*\{\s*x:\s*40,\s*y:\s*200,\s*width:\s*200,\s*height:\s*620/);
    assert.match(layoutSource, /'sixth-study':\s*\{\s*x:\s*840,\s*y:\s*200/);
    assert.match(layoutSource, /'sixth-vintage-dining':\s*\{\s*x:\s*1440,\s*y:\s*200/);
    assert.match(layoutSource, /'sixth-modern-kitchen':\s*\{\s*x:\s*1060,\s*y:\s*860,\s*width:\s*320,\s*height:\s*140/);
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
    assert.match(layoutSource, /studioToolbarControls/);
    assert.match(layoutSource, /studio-toolbar-tabs-stack/);
    assert.match(layoutSource, /renderStudioCategoryTabs\(\)/);
    assert.match(pageStyles, /\.studio-toolbar-controls\s*\{/);
    assert.match(pageStyles, /display:\s*flex;/);
    assert.match(pageStyles, /justify-content:\s*flex-end;/);
    assert.match(pageStyles, /\.studio-toolbar-tabs-stack\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?align-items:\s*flex-end;/);
    assert.doesNotMatch(pageStyles, /\.studio-toolbar-tabs-stack\s*\{[^}]*border:/);
    assert.doesNotMatch(pageStyles, /\.studio-toolbar-tabs-stack\s*\{[^}]*box-shadow:/);
    assert.match(pageStyles, /\.studio-toolbar-controls \.studio-category-tabs\s*\{[\s\S]*?width:\s*112px;[\s\S]*?padding:\s*0;[\s\S]*?gap:\s*2px;[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/);
    assert.match(pageStyles, /\.studio-toolbar-tabs-stack\s*\{[\s\S]*?gap:\s*3px;/);
    assert.match(pageStyles, /\.studio-toolbar-controls \.preview-floor-tabs \.studio-category-tab\s*\{[\s\S]*?min-height:\s*24px;/);
    assert.match(pageStyles, /\.studio-toolbar-controls \.preview-category-tabs \.studio-category-tab\s*\{[\s\S]*?min-height:\s*22px;/);
});

test('预约状态说明固定在实景棚预览右上角且不撑满整行', () => {
    assert.match(layoutStyles, /\.preview-workspace\s*\{[\s\S]*?position:\s*relative;[\s\S]*?padding:\s*30px 0 8px;/);
    assert.match(layoutStyles, /\.studio-booking-page \.list-view\.real-scene-active \.preview-status-legend\s*\{[\s\S]*?top:\s*0;[\s\S]*?right:\s*0;/);
    assert.match(layoutStyles, /\.preview-status-legend\s*\{[\s\S]*?width:\s*max-content;/);
});

test('预约状态说明和画布工具在右上角紧凑排列', () => {
    assert.match(layoutStyles, /\.preview-status-legend\s*\{[\s\S]*?gap:\s*8px;[\s\S]*?padding:\s*4px 7px;/);
    assert.match(layoutStyles, /\.studio-booking-page \.list-view\.real-scene-active\s*\{[\s\S]*?padding:\s*8px 6px 0;/);
    assert.match(layoutStyles, /\.sixth-floor-canvas-toolbar\s*\{[\s\S]*?top:\s*2px;[\s\S]*?right:\s*0;[\s\S]*?gap:\s*2px;[\s\S]*?padding:\s*2px;/);
    assert.match(layoutStyles, /\.sixth-floor-canvas-toolbar button\s*\{[\s\S]*?min-width:\s*21px;[\s\S]*?height:\s*21px;/);
});
