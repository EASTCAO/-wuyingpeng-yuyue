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
    assert.match(layoutSource, /SIXTH_FLOOR_FRAME_INSETS\s*=\s*\{\s*top:\s*76,\s*right:\s*20,\s*bottom:\s*20,\s*left:\s*20\s*\}/);
    assert.match(layoutSource, /SIXTH_FLOOR_DEFAULT_SCALE\s*=\s*0\.75/);
    assert.match(layoutSource, /getSixthFloorLayoutBounds\(layout\)/);
    assert.match(layoutSource, /Math\.min\(SIXTH_FLOOR_DEFAULT_SCALE, widthScale, heightScale\)/);
    assert.match(layoutStyles, /\.preview-floor-map-sixth-floor\s*\{[\s\S]*?min-width:\s*0;/);
});

test('6F 自由画布使用无边框全尺寸视口', () => {
    assert.match(layoutStyles, /\.preview-floor-map-sixth-floor\s*\{[\s\S]*?display:\s*block;/);
    assert.match(layoutStyles, /\.sixth-floor-canvas-viewport\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?box-shadow:\s*none;/);
    assert.match(layoutStyles, /\.studio-booking-page \.list-view\.real-scene-active \.preview-workspace-6f\s*\{[\s\S]*?padding:\s*0 0 4px;/);
    assert.match(layoutStyles, /\.preview-workspace-6f \.preview-status-legend,[\s\S]*?\.preview-workspace-6f \.sixth-floor-canvas-toolbar\s*\{[\s\S]*?right:\s*8px;[\s\S]*?width:\s*152px;[\s\S]*?height:\s*23px;[\s\S]*?justify-content:\s*center;/);
    assert.match(layoutStyles, /\.preview-workspace-6f \.preview-status-legend\s*\{[\s\S]*?top:\s*8px;[\s\S]*?flex-wrap:\s*nowrap;/);
    assert.match(layoutStyles, /\.preview-workspace-6f \.sixth-floor-canvas-toolbar\s*\{[\s\S]*?top:\s*37px;/);
    assert.match(layoutStyles, /\.sixth-floor-canvas\s*\{[\s\S]*?top:\s*calc\(50% \+ 28px\);/);
    assert.match(layoutStyles, /@media \(max-width:\s*768px\)\s*\{[\s\S]*?\.sixth-floor-canvas\s*\{[\s\S]*?top:\s*calc\(50% \+ 92px\);/);
    assert.match(layoutSource, /viewport\.clientWidth - SIXTH_FLOOR_FRAME_INSETS\.left/);
    assert.doesNotMatch(layoutSource, /viewport\.style\.width/);
    assert.doesNotMatch(layoutSource, /viewport\.style\.height/);
    assert.match(layoutSource, /sixth-floor-canvas-viewport[\s\S]*renderPreviewStatusLegend\(\)/);
    assert.match(layoutSource, /preview-workspace-\$\{currentStudioFloor\.toLowerCase\(\)\}/);
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

test('点击已过期实景棚会自动切换到下一可预约日期并打开预约', () => {
    const openCardSource = layoutSource.slice(
        layoutSource.indexOf('function openRealSceneCard(studioId)'),
        layoutSource.indexOf('function handleRealSceneCardKeydown')
    );
    assert.match(openCardSource, /getRealSceneState\(studio, overviewDate\)/);
    assert.match(openCardSource, /if \(state\?\.type === 'ended'\)/);
    assert.match(openCardSource, /selectBookingDate\(targetDate\);/);
    assert.match(openCardSource, /showToast\(`当前日期已过期，已为你切换到\$\{formatShortDate\(targetDate\)\}`/);
    assert.match(openCardSource, /showAddBookingForm\(studioId\);/);
});

test('6F 场景结构变化后拒绝读取旧版个人布局', () => {
    assert.match(layoutSource, /SIXTH_FLOOR_LAYOUT_VERSION\s*=\s*4/);
    assert.match(layoutSource, /stored\?\.version === SIXTH_FLOOR_LAYOUT_VERSION/);
});

test('6F 卡片拖动时不会选中文字', () => {
    assert.match(layoutStyles, /\.sixth-floor-layout-card\s*\{[\s\S]*?user-select:\s*none;/);
});

test('6F 实景卡片使用圆润圆角', () => {
    assert.match(layoutStyles, /\.preview-floor-map-sixth-floor \.preview-scene-card\s*\{[\s\S]*?border-radius:\s*var\(--radius-lg\);/);
});

test('7F 无影棚区域不显示最外层线框', () => {
    assert.match(layoutStyles, /\.preview-single-floor-map \.studio-map-zone-seventh-floor\s*\{[\s\S]*?border:\s*0;/);
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

test('6F 实景卡片轻点优先预约，移动超过阈值后才拖动', () => {
    assert.match(layoutSource, /SIXTH_FLOOR_DRAG_THRESHOLD\s*=\s*10/);
    assert.match(layoutSource, /if \(!state\.moved && Math\.hypot\(dx, dy\) < SIXTH_FLOOR_DRAG_THRESHOLD\) return;/);
    assert.match(layoutSource, /state\.moved = true;[\s\S]*if \(state\.type === 'card'\)/);
    assert.match(layoutSource, /else \{\s*sixthFloorSuppressClick = true;\s*openRealSceneCard\(state\.card\.dataset\.studioId\);/);
});

test('楼层和影棚类型使用四选一高频切换控件', () => {
    assert.match(layoutSource, /studioToolbarControls/);
    assert.match(layoutSource, /renderStudioViewTabs\(\)/);
    assert.match(layoutSource, /6F · 无影棚/);
    assert.match(layoutSource, /6F · 实景棚/);
    assert.match(layoutSource, /7F · 无影棚/);
    assert.match(layoutSource, /7F · 实景棚/);
    assert.match(layoutSource, /selectStudioView\('\$\{view\.floor\}', '\$\{view\.category\}'\)/);
    assert.match(layoutSource, /studio-view:\$\{currentUser \|\| '游客'\}/);
    assert.match(pageStyles, /\.studio-toolbar-controls\s*\{/);
    assert.match(pageStyles, /display:\s*flex;/);
    assert.match(pageStyles, /justify-content:\s*flex-end;/);
    assert.match(pageStyles, /\.studio-view-tabs\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(4,/);
    assert.match(pageStyles, /\.studio-view-tab\s*\{[\s\S]*?min-height:\s*26px;[\s\S]*?border-radius:\s*var\(--radius-xs\);/);
    assert.match(pageStyles, /\.studio-view-tab\.active\s*\{[\s\S]*?background:\s*var\(--accent-solid\);[\s\S]*?color:\s*#FFFFFF;/);
});

test('预约状态说明固定在实景棚预览右上角且不撑满整行', () => {
    assert.match(layoutStyles, /\.preview-workspace\s*\{[\s\S]*?position:\s*relative;[\s\S]*?padding:\s*30px 0 8px;/);
    assert.match(layoutStyles, /\.studio-booking-page \.list-view\.real-scene-active \.preview-status-legend\s*\{[\s\S]*?top:\s*0;[\s\S]*?right:\s*0;/);
    assert.match(layoutStyles, /\.studio-booking-page \.list-view\.real-scene-active \.preview-workspace-6f \.preview-status-legend\s*\{[\s\S]*?top:\s*8px;/);
    assert.match(layoutStyles, /\.preview-status-legend\s*\{[\s\S]*?width:\s*max-content;/);
});

test('预约状态说明和画布工具在右上角紧凑排列', () => {
    assert.match(layoutStyles, /\.preview-status-legend\s*\{[\s\S]*?gap:\s*6px;[\s\S]*?padding:\s*3px 6px;/);
    assert.match(layoutStyles, /\.studio-booking-page \.list-view\.real-scene-active\s*\{[\s\S]*?padding:\s*8px 6px 0;/);
    assert.match(layoutStyles, /\.preview-workspace-6f \.preview-status-legend,[\s\S]*?\.preview-workspace-6f \.sixth-floor-canvas-toolbar\s*\{[\s\S]*?width:\s*152px;[\s\S]*?height:\s*23px;/);
    assert.match(layoutStyles, /\.sixth-floor-canvas-toolbar\s*\{[\s\S]*?top:\s*2px;[\s\S]*?right:\s*0;[\s\S]*?gap:\s*2px;[\s\S]*?padding:\s*1px;/);
    assert.match(layoutStyles, /\.sixth-floor-canvas-toolbar button\s*\{[\s\S]*?min-width:\s*19px;[\s\S]*?height:\s*19px;/);
});

// 用花括号配平切出每条规则。之前用 [\s\S]*? 的嵌套正则会跨过块边界匹配到别的规则，
// 也会把注释算进选择器，所以这里老老实实扫一遍。
function parseRules(css) {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [];
    let depth = 0;
    let selectorStart = 0;
    let blockStart = 0;

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        if (char === '{') {
            if (depth === 0) blockStart = index;
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                const selector = source.slice(selectorStart, blockStart).trim();
                const body = source.slice(blockStart + 1, index);
                // @media 之类的包装块：递归取里面的规则
                if (selector.startsWith('@')) rules.push(...parseRules(body));
                else rules.push({ selector, body });
                selectorStart = index + 1;
            }
        }
    }
    return rules;
}

const LAYOUT_RULES = parseRules(layoutStyles);

function findRule(selector) {
    const normalize = value => value.split(',').map(part => part.trim()).filter(Boolean).join(',');
    const rule = LAYOUT_RULES.find(item => normalize(item.selector) === selector);
    assert.ok(rule, `没有找到 CSS 规则: ${selector}`);
    return rule.body;
}

function pxValue(body, property) {
    const match = body.match(new RegExp(`(?:^|[;{\\s])${property}:\\s*(\\d+)px`));
    assert.ok(match, `规则里没有 ${property} 的像素值`);
    return Number(match[1]);
}

const SIXTH_FLOOR_PREFIX = '.studio-booking-page .list-view.real-scene-active .preview-workspace-6f';
const SHARED_BOX_SELECTOR = `${SIXTH_FLOOR_PREFIX} .preview-status-legend,${SIXTH_FLOOR_PREFIX} .sixth-floor-canvas-toolbar`;

test('工具条紧贴在状态说明下方且两者等宽', () => {
    // 共用同一条尺寸规则是"等宽"的结构保证，比分别断言两个宽度更难写歪。
    const sharedBox = findRule(SHARED_BOX_SELECTOR);
    const height = pxValue(sharedBox, 'height');
    const legendTop = pxValue(findRule(`${SIXTH_FLOOR_PREFIX} .preview-status-legend`), 'top');
    const toolbarTop = pxValue(findRule(`${SIXTH_FLOOR_PREFIX} .sixth-floor-canvas-toolbar`), 'top');

    // 工具条必须落在状态说明下沿之后，且间距保持在 4-8px 的紧凑区间内。
    const gap = toolbarTop - (legendTop + height);
    assert.ok(gap >= 4 && gap <= 8, `两者间距应为 4-8px，实际 ${gap}px`);
});

test('按钮高度正好填满工具条，不会溢出圆角边框', () => {
    const sharedBox = findRule(SHARED_BOX_SELECTOR);
    assert.match(sharedBox, /box-sizing:\s*border-box;/);

    const toolbarHeight = pxValue(sharedBox, 'height');
    const toolbarPadding = pxValue(findRule('.sixth-floor-canvas-toolbar'), 'padding');
    const buttonHeight = pxValue(findRule('.sixth-floor-canvas-toolbar button'), 'height');

    // 外框高 - 上下 1px 边框 - 上下内边距 = 按钮可用高度
    const available = toolbarHeight - 2 - toolbarPadding * 2;
    assert.equal(buttonHeight, available, `按钮应为 ${available}px，实际 ${buttonHeight}px`);
});
