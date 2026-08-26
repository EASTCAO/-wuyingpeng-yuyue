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
    assert.match(layoutSource, /SIXTH_FLOOR_LAYOUT_VERSION\s*=\s*6/);
    assert.match(layoutSource, /stored\?\.version === SIXTH_FLOOR_LAYOUT_VERSION/);
});

test('6F 卡片拖动时不会选中文字', () => {
    assert.match(layoutStyles, /\.sixth-floor-layout-card\s*\{[\s\S]*?user-select:\s*none;/);
});

test('6F 实景卡片使用圆润圆角', () => {
    // 画布整体缩到 70%，圆角会跟着被压掉三成，所以这里只要求"不小于 lg"，
    // 不写死某个 token——换成更圆的 xl 是改进，不该让测试变红。
    const rule = layoutStyles.match(/\.preview-floor-map-sixth-floor \.preview-scene-card\s*\{([\s\S]*?)\}/);
    assert.ok(rule, '没有找到 6F 实景卡片规则');
    const radius = rule[1].match(/border-radius:\s*var\((--radius-(?:lg|xl))\)/);
    assert.ok(radius, `圆角应至少为 --radius-lg，实际规则：${rule[1].trim()}`);
});

test('6F 每个景都有身份色，且暖色景不会被误读成预约状态', () => {
    const tints = [...layoutStyles.matchAll(
        /\[data-map-area="(sixth-[\w-]+)"\]\s*\{\s*--scene-tint:\s*(#[0-9A-Fa-f]{6})/g
    )].map(match => ({ area: match[1], hex: match[2] }));

    // 21 个景每个都要有自己的身份色，漏一个就会退回默认灰。
    assert.equal(tints.length, 21, `应有 21 个景的身份色，实际 ${tints.length}`);
    assert.equal(new Set(tints.map(item => item.area)).size, 21, '有景的身份色重复声明');

    const saturation = hex => {
        const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
        const max = Math.max(r, g, b);
        return max ? (max - Math.min(r, g, b)) / max : 0;
    };
    const hue = hex => {
        const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
        const max = Math.max(r, g, b);
        const delta = max - Math.min(r, g, b);
        if (!delta) return 0;
        let value = max === r ? 60 * (((g - b) / delta) % 6)
            : max === g ? 60 * ((b - r) / delta + 2)
                : 60 * ((r - g) / delta + 4);
        return value < 0 ? value + 360 : value;
    };

    // 卡面填充归"预约状态"，身份色只是右下角柔光。落在橙色相区间的暖色景必须
    // 把饱和度压到 partial 状态（23%）以下，否则"复古餐厅景"看着就像已约满。
    for (const { area, hex } of tints) {
        const isWarm = hue(hex) >= 0 && hue(hex) <= 45;
        if (isWarm) {
            assert.ok(
                saturation(hex) < 0.23,
                `${area} 落在橙色相区且饱和度 ${(saturation(hex) * 100).toFixed(0)}% 不低于 partial 状态，会和预约状态混淆`
            );
        }
    }

    // 状态卡必须撤掉身份柔光，否则橙底叠色斑会糊成脏色。
    assert.match(
        layoutStyles,
        /\.preview-scene-card\.partial::after,[\s\S]{0,200}?\.preview-scene-card\.full::after,[\s\S]{0,200}?::after\s*\{\s*background:\s*none;/
    );
});

test('6F 实拍封面的压暗遮罩足够深，白色景名在任何照片上都可读', () => {
    const scrim = layoutStyles.match(
        /\.preview-scene-card\.has-scene-cover::before\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(scrim, '没有找到实拍封面的压暗遮罩规则');

    const stops = [...scrim[1].matchAll(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\s*\)\s+([\d.]+)%/g)]
        .map(match => ({ alpha: Number(match[1]), position: Number(match[2]) }));
    assert.ok(stops.length >= 3, '遮罩应是多段渐变');

    // 白字压在合成色上的对比度。合成最坏情况按"照片该处接近纯白"算。
    const relative = channel => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };
    const whiteTextContrast = alpha => {
        const blended = [12, 18, 26].map(scrimChannel => 255 * (1 - alpha) + scrimChannel * alpha);
        const luminance = 0.2126 * relative(blended[0])
            + 0.7152 * relative(blended[1])
            + 0.0722 * relative(blended[2]);
        return 1.05 / (luminance + 0.05);
    };

    // 景名垂直居中偏下，落在 >=50% 的位置。那一带必须撑住 AA。
    for (const stop of stops.filter(item => item.position >= 50)) {
        const ratio = whiteTextContrast(stop.alpha);
        assert.ok(
            ratio >= 4.5,
            `遮罩在 ${stop.position}% 处仅 ${stop.alpha}，照片偏亮时白字只有 ${ratio.toFixed(2)}:1，不足 AA`
        );
    }

    // 有照片时必须撤掉身份色柔光，否则照片上叠色斑会脏。
    assert.match(
        layoutStyles,
        /\.preview-scene-card\.has-scene-cover::after\s*\{\s*background:\s*none;/
    );
});

test('实拍封面样式不绑定楼层，6F 和 7F 共用同一套观感', () => {
    // 6F 是绝对定位画布、7F 是 CSS grid，但封面样式必须共用，否则两个楼层
    // 会长成两个样子。这里断言选择器没有被限定回 6F 画布。
    for (const selector of [
        '.preview-scene-cover',
        '.preview-scene-card.has-scene-cover::before',
        '.preview-scene-card.has-scene-cover::after'
    ]) {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(layoutStyles, new RegExp(`(^|\\n)${escaped}`),
            `${selector} 应是不限楼层的全局规则`);
        assert.doesNotMatch(layoutStyles, new RegExp(`preview-floor-map-sixth-floor ${escaped}`),
            `${selector} 被限定到了 6F，7F 会拿不到封面样式`);
    }

    // 7F 的 11 个景都要有封面，缺一个就会在网格里露出白卡。
    const seventhFloorScenes = [
        '小木屋景', '卧室景', '酒吧景', '书房景', '客厅景', '工具台景',
        '木纹台面-厨房景', '儿童房景/户外下午茶景', '洗衣房景别', '浴室景', '黑色台面-厨房景'
    ];
    // 景名里有 / 和 -，正则转义容易写歪，这里改成按字面量定位再取 cover。
    for (const scene of seventhFloorScenes) {
        const start = layoutSource.indexOf(`'${scene}':`);
        assert.notEqual(start, -1, `${scene} 不在 STUDIO_SCENE_REFERENCES 里`);
        const entry = layoutSource.slice(start, layoutSource.indexOf('}', start));
        assert.match(entry, /cover:\s*'[\w-]+\.webp'/, `${scene} 没有配实拍封面`);
    }

    // 封面路径统一由 getSceneReference 拼版本号，避免散落的 ?v= 漏改。
    assert.match(layoutSource, /SCENE_COVER_VERSION/);
    assert.match(layoutSource, /assets\/real-studio\/\$\{reference\.cover\}\?v=\$\{SCENE_COVER_VERSION\}/);
});

test('7F 无影棚区域不显示最外层线框', () => {
    assert.match(layoutStyles, /\.preview-single-floor-map \.studio-map-zone-seventh-floor\s*\{[\s\S]*?border:\s*0;/);
});

test('6F 卡片使用高优先级绝对定位而不会落入普通文档流', () => {
    assert.match(layoutStyles, /\.preview-floor-map-sixth-floor\s+\.sixth-floor-layout-card\s*\{[\s\S]*?position:\s*absolute;/);
});

// 从源码里解析出默认布局坐标。studio-layout.js 依赖一堆全局量、require 不进来，
// 所以这里只做一次纯文本提取，后面的断言全部对着解析出的数字跑。
function parseDefaultLayout() {
    const block = layoutSource.match(/SIXTH_FLOOR_DEFAULT_LAYOUT = \{([\s\S]*?)\n\};/);
    assert.ok(block, '没有找到 SIXTH_FLOOR_DEFAULT_LAYOUT');
    const layout = {};
    for (const line of block[1].split('\n')) {
        const card = line.match(/'([\w-]+)':\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*width:\s*(\d+),\s*height:\s*(\d+)/);
        if (card) layout[card[1]] = { x: +card[2], y: +card[3], width: +card[4], height: +card[5] };
    }
    return layout;
}

test('6F 默认布局的卡片互不重叠且都在画布内', () => {
    const layout = parseDefaultLayout();
    const entries = Object.entries(layout);
    assert.equal(entries.length, 21);

    for (const [key, card] of entries) {
        assert.ok(card.x >= 0 && card.y >= 0, `${key} 坐标为负`);
        assert.ok(card.x + card.width <= 1800, `${key} 右沿超出画布`);
        assert.ok(card.y + card.height <= 1040, `${key} 下沿超出画布`);
    }

    // 重叠会让两个棚在画布上叠在一起，点击命中也会串，属于必须挡住的回退。
    for (let i = 0; i < entries.length; i += 1) {
        for (let j = i + 1; j < entries.length; j += 1) {
            const [aKey, a] = entries[i];
            const [bKey, b] = entries[j];
            const overlaps = a.x < b.x + b.width && b.x < a.x + a.width
                && a.y < b.y + b.height && b.y < a.y + a.height;
            assert.ok(!overlaps, `${aKey} 和 ${bKey} 重叠`);
        }
    }
});

test('6F 默认布局用间距分级分出三条功能带，而不是一张均匀网格', () => {
    assert.match(layoutSource, /SIXTH_FLOOR_LAYOUT_VERSION\s*=\s*6/);
    assert.match(layoutSource, /SIXTH_FLOOR_CANVAS_SIZE\s*=\s*\{\s*width:\s*1800,\s*height:\s*1040\s*\}/);

    const layout = parseDefaultLayout();
    const rowStarts = [...new Set(Object.values(layout).map(card => card.y))].sort((a, b) => a - b);
    const topBand = Object.values(layout).filter(card => card.y === rowStarts[0]);
    const bottomBand = Object.values(layout).filter(card => card.y === rowStarts[rowStarts.length - 1]);

    // 左右两端必须收齐，否则整块布局会看着豁口。
    const left = Math.min(...Object.values(layout).map(card => card.x));
    const right = Math.max(...Object.values(layout).map(card => card.x + card.width));
    assert.equal(left, 40);
    assert.equal(right, 1760);

    // 带间距要明显大于带内间距，布局才靠疏密分组而不是靠均匀网格摊平。
    const topBottom = Math.max(...topBand.map(card => card.y + card.height));
    const secondRowTop = rowStarts.find(y => y > topBottom - 1 && y > rowStarts[0]);
    assert.ok(secondRowTop - topBottom >= 48, `带间距应 >=48px，实际 ${secondRowTop - topBottom}px`);

    // 顶排和底排不能是同一套等分列位，否则上下两条栅栏会把中段夹成三明治。
    const topX = topBand.map(card => card.x).sort((a, b) => a - b).join(',');
    const bottomX = bottomBand.map(card => card.x).sort((a, b) => a - b).join(',');
    assert.notEqual(topX, bottomX, '顶排和底排的列位完全相同，布局过于规整');

    // 每一排都不是等宽等分。
    assert.ok(new Set(topBand.map(card => card.width)).size > 1, '顶排是等宽等分');
    assert.ok(new Set(bottomBand.map(card => card.width)).size > 1, '底排是等宽等分');
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
