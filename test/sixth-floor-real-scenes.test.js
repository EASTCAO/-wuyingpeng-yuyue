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

test('实拍封面是内嵌窗口，景名落在面板上而不是压着照片', () => {
    // 照片做成内嵌窗口（四周留 gutter），文字在照片下方的卡面板上。
    // 这条替代了原来"径向压暗遮罩 + 白字描边"那套——那套是为了让白字
    // 在明暗不可控的照片上还能读；文字挪到面板上之后就不该再有遮罩了。
    const cover = layoutStyles.match(
        /\n\.preview-scene-cover\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(cover, '没有找到实拍封面规则');

    // 照片必须参与文档流（relative/flex），absolute inset:0 会让它重新铺满整卡。
    assert.match(cover[1], /position:\s*relative/,
        '照片应参与文档流，absolute 会让它重新铺满整张卡');
    assert.doesNotMatch(cover[1], /inset:\s*0/,
        '照片是内嵌窗口，不应再 inset: 0 铺满');

    // 窗口自己要有圆角，否则和"卡面留白"合起来看着像张贴歪的图。
    assert.match(cover[1], /border-radius:\s*var\(--radius-(?:md|lg|xl)\)/,
        '照片窗口应有自己的圆角');

    // 卡片要给出 gutter，照片才浮得起来。
    const card = layoutStyles.match(
        /\n\.preview-scene-card\.has-scene-cover\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(card, '没有找到封面卡规则');
    const padding = card[1].match(/padding:\s*(\d+)px/);
    assert.ok(padding && Number(padding[1]) > 0,
        '封面卡必须有 padding，否则照片贴边、内嵌窗口的观感不成立');

    // 压暗遮罩和白字描边都不该再存在。
    assert.doesNotMatch(layoutStyles, /--cover-scrim/,
        '文字已移出照片，压暗遮罩变量不该再有残留');
    assert.doesNotMatch(layoutStyles, /--cover-wash/,
        '照片在卡内窗口里，不该有盖住整卡的罩层变量');

    // 照片要被弱化，让景名成为第一落点。
    const sat = cover[1].match(/saturate\(([\d.]+)\)/);
    assert.ok(sat && Number(sat[1]) <= 0.75,
        `照片应降饱和到 <=0.75 才不抢视觉，实际 saturate(${sat && sat[1]})`);
    const op = cover[1].match(/opacity:\s*([\d.]+)/);
    assert.ok(op && Number(op[1]) < 1 && Number(op[1]) >= 0.7,
        `照片透明度应在 [0.7, 1) 之间弱化，实际 ${op && op[1]}`);

    const coverTitle = layoutStyles.match(
        /\.preview-scene-card\.has-scene-cover h4\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(coverTitle, '没有找到封面卡的景名规则');
    // 景名做成"立体墙"：字有上高光 / 下暗边，底板有发光。
    assert.match(coverTitle[1], /text-shadow:/,
        '景名应有 text-shadow 撑出字的厚度');
    const size = coverTitle[1].match(/font-size:\s*(\d+)px/);
    assert.ok(size && Number(size[1]) >= 15,
        `景名字号应 >=15px 才够突出，实际 ${size && size[1]}`);

    const relative = channel => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };
    const luminance = rgb => 0.2126 * relative(rgb[0]) + 0.7152 * relative(rgb[1]) + 0.0722 * relative(rgb[2]);
    const contrast = (a, b) => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
    };
    const toRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const mix = (a, b, t) => toRgb(a).map((channel, i) => channel + (toRgb(b)[i] - channel) * t);

    // 景名压在面板最深的那一档上仍要过 AA。面板 = 身份色往白里调，
    // 最深那段的混合比例从 CSS 里读，避免和实现分叉。
    const ink = coverTitle[1].match(/color:\s*(#[0-9A-Fa-f]{6})/);
    assert.ok(ink, '封面卡的景名应指定颜色');

    // 卡面渐变最深那段。它和上面的 padding 不在同一条规则里
    // （柔和渐变是单独一块），所以在整张样式表里找。
    const face = layoutStyles.match(
        /color-mix\(in srgb, var\(--scene-tint[^)]*\), #FFFFFF (\d+)%\) 100%/
    );
    assert.ok(face, '没有找到卡面渐变最深那段');
    const whiteRatio = Number(face[1]) / 100;

    const tints = [...layoutStyles.matchAll(
        /\[data-map-area="(sixth-[\w-]+)"\]\s*\{\s*--scene-tint:\s*(#[0-9A-Fa-f]{6})/g
    )].map(match => match[2]);
    assert.ok(tints.length >= 21, '身份色数量不足，无法覆盖最坏情况');

    // 文字并不直接压在卡面上，中间还有一块近白底板。合成链是
    // 卡面 → 底板 → 文字，底板必须算进去，否则会低估实际对比度。
    // 底板不能太透：在浅色卡面上看不出边界，立体墙和发光都会塌。
    const plate = coverTitle[1].match(
        /background:\s*rgba\(\s*255,\s*255,\s*255,\s*([\d.]+)\s*\)/
    );
    assert.ok(plate, '景名应坐在近白底板上，否则立体墙和发光无从依附');
    const plateAlpha = Number(plate[1]);
    assert.ok(plateAlpha >= 0.85,
        `底板 ${plateAlpha} 太透，在浅色卡面上看不出边界，景名浮不起来`);

    for (const tint of tints) {
        // color-mix(tint, #FFFFFF N%) = 往白里调 N%，即 tint 占 (1-N)
        const panel = mix(tint, '#FFFFFF', whiteRatio);
        const underText = panel.map(channel => 255 * plateAlpha + channel * (1 - plateAlpha));
        const ratio = contrast(toRgb(ink[1]), underText);
        assert.ok(ratio >= 4.5,
            `景名 ${ink[1]} 在 ${tint} 的卡面 + 底板上只有 ${ratio.toFixed(2)}:1，不足 AA`);
    }

    // 底板的发光和内高光是"立体墙"的来源，缺了字就贴在平面上。
    const box = coverTitle[1].match(/box-shadow:([\s\S]*?);/);
    assert.ok(box, '景名底板应有 box-shadow');
    const boxLayers = box[1].split(',').map(entry => entry.trim());
    const glowIndex = boxLayers.findIndex(entry => /^0\s+0\s+\d{2}px/.test(entry));
    assert.ok(glowIndex !== -1, '底板缺少发光层（0 0 <大半径>）');
    assert.ok(boxLayers.some(entry => /^inset\s+0\s+1px\s+0/.test(entry)),
        '底板缺少内上沿高光（inset 0 1px 0），托不出"凸起的墙"');
    const dropIndex = boxLayers.findIndex(entry => /^0\s+1px\s+\dpx/.test(entry));
    assert.ok(dropIndex !== -1, '底板缺少落地投影（0 1px <小半径>）');
    assert.ok(glowIndex > dropIndex,
        '辉光必须写在落地投影之后，否则会被它盖掉');

    // 素材本身偏暗，封面要提亮才立得起来。
    assert.match(layoutStyles, /\.preview-scene-cover\s*\{[\s\S]*?filter:[^;]*brightness\(1\.[0-9]+\)/);

    // 有照片时必须撤掉身份色柔光，否则照片上叠色斑会脏。
    assert.match(
        layoutStyles,
        /\.preview-scene-card\.has-scene-cover::after\s*\{\s*background:\s*none;/
    );
});

test('照片内嵌窗口不会被基类的 height: 100% 压成 0 高', () => {
    // 基类给 .preview-scene-card-top 写了 height: 100%，它会吃掉整张卡的高度，
    // 照片作为 flex 兄弟被压成 0 高——卡上只剩标题，照片彻底看不见。
    // 这个塌陷在样式表里完全看不出来（没有报错、没有异常值），只有量渲染
    // 结果才发现，所以在这里钉死。
    const top = layoutStyles.match(
        /\.preview-scene-card\.has-scene-cover \.preview-scene-card-top\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(top, '没有找到封面卡的文字区规则');
    assert.match(top[1], /height:\s*auto/,
        '必须覆盖基类的 height: 100%，否则照片被挤成 0 高');
});

test('所有封面卡结构统一，不再按卡高分出横排分支', () => {
    // 曾经给矮卡做过容器查询分支，同一屏里出现两种排版反而更乱。现在
    // 统一成一种：照片在左（卡内窗口）、景名在右上、进度条紧跟景名在右下，
    // 卡的大小差异不再影响排版。
    assert.doesNotMatch(layoutStyles, /@container scene-card/,
        '容器查询分支应已删除，所有封面卡结构统一');
    assert.doesNotMatch(layoutStyles, /container-type:\s*size/,
        'container-type 只为那条分支服务，删掉后不该留残留');
    assert.doesNotMatch(layoutStyles, /100cqh/,
        'cqh 只在那条分支里用过，应随它一起删掉');

    const card = layoutStyles.match(
        /\n\.preview-scene-card\.has-scene-cover\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(card, '没有找到封面卡规则');

    // 左照片 / 右文字 = 两列；景名 / 进度条 = 两行。
    assert.match(card[1], /display:\s*grid/,
        '照片在左、文字在右，需要 grid 两列；flex 竖排做不到');
    assert.match(card[1], /grid-template-columns:\s*minmax\([^)]*\)\s+minmax\([^)]*\)/,
        '两列都应用 minmax 定宽，否则长景名会把照片列挤没');
    assert.match(card[1], /align-items:\s*start/,
        '右列内容从顶部开始排，景名才和照片上沿齐平');
});

test('封面卡三块内容各就各位：照片跨两行占左列，景名和进度条叠在右列', () => {
    // 这三条 grid 定位是"照片在左、景名在右、进度条在景名下面"的全部实现。
    // 少任何一条，元素就退回自动流：进度条会跑到照片下面另起一行。
    // 选择器可能出现在一条逗号分隔的选择器组里（例如同时压掉 .has-progress
    // 的基类样式），所以允许它后面先跟别的选择器再到 {。取所有命中的规则体，
    // 挑出真正声明了 grid 定位的那条。
    const placement = selector => {
        const bodies = [...layoutStyles.matchAll(new RegExp(
            `\\.preview-scene-card\\.has-scene-cover ${selector}[^{]*\\{([\\s\\S]*?)\\n\\}`,
            'g'
        ))].map(entry => entry[1]);
        assert.ok(bodies.length > 0, `没有找到 ${selector} 的规则`);
        const placed = bodies.find(body => /grid-(?:column|row):/.test(body));
        assert.ok(placed, `${selector} 没有任何 grid 定位声明`);
        return placed;
    };

    const cover = placement('\\.preview-scene-cover');
    assert.match(cover, /grid-column:\s*1/, '照片应占左列');
    assert.match(cover, /grid-row:\s*1\s*\/\s*span 2/,
        '照片要跨满两行，否则右列进度条那行会在照片下方留出空档');

    // 景名裹在 .preview-scene-card-top 里，进网格的是这个容器而不是 h4 本身。
    const top = placement('\\.preview-scene-card-top');
    assert.match(top, /grid-column:\s*2/, '景名应在右列');
    assert.match(top, /grid-row:\s*1/, '景名在右列第一行');

    const progress = placement('\\.preview-scene-progress');
    assert.match(progress, /grid-column:\s*2/,
        '进度条应和景名同在右列，才是"在景名下面"而不是"在照片下面"');
    assert.match(progress, /grid-row:\s*2/, '进度条在右列第二行，紧跟景名');
});

test('进度条紧跟景名，和景名同为突出信息', () => {
    // 进度条不该缩在角落——它和景名一样是要突出的信息，所以共用
    // 同一块"发光底板"的视觉语言。
    // 同一个选择器有两条规则：一条共用的（position/z-index），一条带底板的。
    // 用 matchAll 全取，再挑出声明了底板的那条——只取第一个匹配会拿到
    // 共用那条，看起来像"底板丢了"。
    const progRules = [...layoutStyles.matchAll(
        /\.preview-scene-card\.has-scene-cover \.preview-scene-progress \{([\s\S]*?)\n\}/g
    )].map(entry => entry[1]);
    assert.ok(progRules.length > 0, '没有找到封面卡的进度条规则');
    const prog = progRules.find(body => /border-radius/.test(body));
    assert.ok(prog, '进度条应有自己的底板规则（带 border-radius）');
    assert.match(prog, /border-radius:\s*var\(--radius-pill\)/,
        '进度条应和景名一样是胶囊底板');
    assert.match(prog, /box-shadow:/,
        '进度条底板应有阴影/发光，才和景名是同一套语言');

    const track = layoutStyles.match(
        /\.preview-scene-card\.has-scene-cover \.preview-scene-progress-track\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(track, '没有找到封面卡的进度条轨道规则');
    assert.match(track[1], /inset\s+0\s+1px/,
        '轨道应有内阴影做出凹槽，和景名的立体感呼应');

    const small = layoutStyles.match(
        /\.preview-scene-card\.has-scene-cover \.preview-scene-progress small\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(small, '没有找到封面卡的进度数字规则');
    assert.match(small[1], /font-weight:\s*[6-9]00/,
        '进度数字应加粗，它和景名一样要突出');
    assert.match(small[1], /text-shadow/,
        '进度数字应有辉光，和景名保持一致');
});

test('还能约的景保留照片，约不了的换成纯色卡', () => {
    const render = layoutSource.slice(
        layoutSource.indexOf('function renderRealSceneCard'),
        layoutSource.indexOf('function handleSixthFloorCardClick')
    );

    // 分界是"还能不能约"，不是"约没约过"：部分预约仍然可约，应该让人
    // 看得见场景再决定；已约满/已过期才从选择里排除掉。
    assert.match(render, /state\.type === 'available'\s*\|\|\s*state\.type === 'partial'/);
    assert.doesNotMatch(render, /showCover[\s\S]{0,120}?state\.type === 'full'/);
    assert.doesNotMatch(render, /showCover[\s\S]{0,120}?state\.type === 'ended'/);

    // has-scene-cover 和 <img> 都要跟着 showCover 走，漏一个就会出现
    // "纯色卡底下压着一张照片"或"照片上盖着橙色"的半吊子状态。
    assert.match(render, /\$\{showCover \? ' has-scene-cover' : ''\}/);
    assert.match(render, /\$\{showCover \? `[\s\S]*?class="preview-scene-cover"/);

    // 约不了的两种状态必须还有纯色样式，这是"排除掉"的落点。
    for (const state of ['full', 'ended']) {
        assert.match(
            layoutStyles,
            new RegExp(`(^|\\n)\\.preview-scene-card\\.${state}\\s*\\{[\\s\\S]*?background:`),
            `.${state} 的纯色卡片样式丢了`
        );
    }

    // 部分预约：照片保持原色不再被罩层盖住，状态色落在"照片窗口描边 +
    // 下方面板"上。原来那层浅蓝罩层压在照片上，暖色场景（酒吧、小木屋、
    // 木纹厨房）容易糊成一片，内嵌窗口之后不再需要它。
    const partialPhoto = layoutStyles.match(
        /\.preview-scene-card\.partial\.has-scene-cover \.preview-scene-cover\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(partialPhoto, '没有找到部分预约的照片规则');
    assert.doesNotMatch(partialPhoto[1], /mix-blend-mode:\s*luminosity/,
        'luminosity 会抽掉照片颜色，画面发糊');
    const opacity = partialPhoto[1].match(/opacity:\s*([\d.]+)/);
    assert.ok(opacity && Number(opacity[1]) >= 0.9,
        '照片本身应保持不透明');

    // 部分预约必须和可预约看得出区别。现在状态色落在整张卡上（描边 +
    // 渐变底），而不是照片窗口的描边——照片窗口在所有状态下保持中性，
    // 才不会和景名的立体墙抢视觉。
    const partialCard = layoutStyles.match(
        /\n\.preview-scene-card\.partial \{([\s\S]*?)\n\}/
    );
    assert.ok(partialCard, '没有找到部分预约的卡片规则');
    assert.match(partialCard[1], /--card-edge:\s*#[0-9A-Fa-f]{6}/,
        '部分预约应改写卡片描边色，才和可预约拉开区别');
    assert.match(partialCard[1], /background:\s*linear-gradient/,
        '部分预约应有自己的渐变底，纯靠描边区分太弱');

    const relative = channel => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };
    const luminance = rgb => 0.2126 * relative(rgb[0]) + 0.7152 * relative(rgb[1]) + 0.0722 * relative(rgb[2]);
    const partialTitle = layoutStyles.match(
        /\.preview-scene-card\.partial\.has-scene-cover h4\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(partialTitle, '没有找到部分预约的景名颜色规则');
    const ink = partialTitle[1].match(/color:\s*#([0-9A-Fa-f]{6})/);
    assert.ok(ink, '部分预约的景名应指定颜色');
    const inkRgb = [0, 2, 4].map(i => parseInt(ink[1].slice(i, i + 2), 16));

    // 景名压在面板渐变最深那段上要过 AA。面板色从 CSS 里读，避免和实现分叉。
    const panelStops = [...partialCard[1].matchAll(/#([0-9A-Fa-f]{6})\s+\d+%/g)]
        .map(match => [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16)));
    assert.ok(panelStops.length >= 2, '部分预约的面板应是渐变');

    for (const stop of panelStops) {
        const ratio = (Math.max(luminance(inkRgb), luminance(stop)) + 0.05)
            / (Math.min(luminance(inkRgb), luminance(stop)) + 0.05);
        assert.ok(ratio >= 4.5,
            `景名在面板色 rgb(${stop}) 上只有 ${ratio.toFixed(2)}:1，不足 AA`);
    }

    // 这条覆写必须写在通用封面景名规则之后才盖得住。
    const coverTitle = layoutStyles.search(/\.preview-scene-card\.has-scene-cover h4\s*\{/);
    const partialTitlePos = layoutStyles.search(/\.preview-scene-card\.partial\.has-scene-cover h4\s*\{/);
    assert.ok(partialTitlePos > coverTitle,
        '.partial.has-scene-cover h4 必须写在 .has-scene-cover h4 之后');

    // 约满和过期不该再有封面覆写规则——它们永远不会有照片。
    assert.doesNotMatch(
        layoutStyles,
        /\.has-scene-cover\.(full|ended)\s*\{/,
        '约满/过期的卡不会有照片，这些覆写永远命中不了'
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

test('封面卡的景名不会被状态文字色覆盖', () => {
    // .full h4 / .ended h4 和 .has-scene-cover h4 特指度相同，后写的赢。
    // 顺序写反的话，满约卡的深蓝字会盖掉封面卡自己的景名色。
    const coverTitle = layoutStyles.search(/\.preview-scene-card\.has-scene-cover h4\s*\{/);
    assert.notEqual(coverTitle, -1, '没有找到封面卡的景名规则');

    for (const state of ['full', 'ended']) {
        const stateTitle = layoutStyles.search(new RegExp(`\\.preview-scene-card\\.${state} h4\\s*\\{`));
        assert.notEqual(stateTitle, -1, `没有找到 .${state} h4 规则`);
        assert.ok(
            coverTitle > stateTitle,
            `.has-scene-cover h4 必须写在 .${state} h4 之后，否则封面上的景名会被状态色盖掉`
        );
    }

    // 现在封面只出现在可预约的卡上，所以不再需要列 .has-scene-cover.full 之类的
    // 状态组合。但上面那条顺序约束要保留：将来若放开条件，顺序写反会立刻踩回旧坑。
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

// 四个组合平铺出来要占满一整行，把日期挤到第二行；收成一个触发器之后，
// 工具栏只剩当前场地这一处宽度很窄的信息块，浮层展开也不占布局。
test('楼层和影棚类型收进当前场地浮层选择器', () => {
    assert.match(layoutSource, /studioToolbarControls/);
    assert.match(layoutSource, /renderStudioVenuePicker\(\)/);
    assert.match(layoutSource, /const STUDIO_FLOORS = \['6F', '7F'\]/);
    assert.match(layoutSource, /value: 'cyclorama', label: '无影棚'/);
    assert.match(layoutSource, /value: 'real-scene', label: '实景棚'/);
    // 触发器上只写当前场地，展开状态同步到 aria-expanded
    assert.match(layoutSource, /id="studioVenueTrigger"[\s\S]*?aria-haspopup="true" aria-expanded="\$\{studioVenuePanelOpen\}"[\s\S]*?aria-controls="studioVenuePanel"/);
    assert.match(layoutSource, /studio-venue-current">\$\{currentStudioFloor\} · \$\{getStudioCategoryLabel\(currentStudioCategory\)\}/);
    // 触发器自己说明白了，旁边不再挂"当前场地"标签
    assert.doesNotMatch(layoutSource, /studio-venue-label/);
    assert.doesNotMatch(pageStyles, /\.studio-venue-label/);
    // 面板两行：一行楼层、一行棚型
    assert.match(layoutSource, /id="studioVenuePanel"[\s\S]*?role="group" aria-label="选择楼层和影棚类型"/);
    assert.match(layoutSource, /studio-venue-row-label">楼层</);
    assert.match(layoutSource, /studio-venue-row-label">棚型</);
    assert.match(layoutSource, /selectStudioView\('\$\{floor\}', currentStudioCategory\)/);
    assert.match(layoutSource, /selectStudioView\(currentStudioFloor, '\$\{category\.value\}'\)/);
    assert.match(layoutSource, /studio-view:\$\{currentUser \|\| '游客'\}/);
    // 浮层要能收起来：选完、点外部、按 Escape 三条路
    assert.match(layoutSource, /if \(event\.target\.closest\('\.studio-venue-picker'\)\) return;/);
    assert.match(layoutSource, /event\.key === 'Escape' && isStudioVenuePanelOpen\(\)/);
    assert.match(layoutSource, /closeStudioVenuePanel\(\);/);
    assert.match(pageStyles, /\.studio-toolbar-controls\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*flex-end;/);
    assert.match(pageStyles, /\.studio-venue-trigger\s*\{[\s\S]*?min-height:\s*26px;[\s\S]*?border-radius:\s*var\(--radius-xs\);/);
    assert.match(pageStyles, /\.studio-venue-panel\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?z-index:\s*1200;/);
    assert.match(pageStyles, /\.studio-venue-option\.active\s*\{[\s\S]*?background:\s*var\(--accent-solid\);[\s\S]*?color:\s*#FFFFFF;/);
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
