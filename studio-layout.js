const baseRenderStudioSections = renderStudioSections;
const baseRenderBookings = renderBookings;
const baseInitStudioUI = initStudioUI;
const STUDIO_OVERVIEW_SEGMENTS = 18;
// 实拍封面。照片比抽象渐变更能说明"这是哪个景"，而且不会和预约状态的色块争语义。
// cover 字段驱动卡面封面，6F 画布和 7F 网格共用同一套渲染。
// 素材来自 assets/real-studio/source/，统一压成 900px 宽的 webp。
// src 是 hover 弹层用的大图（历史字段，只有洗衣房景别有）。
const SCENE_COVER_VERSION = '20260826-cover-available';
const STUDIO_SCENE_REFERENCES = {
    // 7F 实景棚：11 个景全部有实拍素材
    '小木屋景': { cover: 'small-cabin.webp', alt: '小木屋景场景示意图' },
    '卧室景': { cover: 'bedroom.webp', alt: '卧室景场景示意图' },
    '酒吧景': { cover: 'bar.webp', alt: '酒吧景场景示意图' },
    '书房景': { cover: 'study.webp', alt: '书房景场景示意图' },
    '客厅景': { cover: 'living-room.webp', alt: '客厅景场景示意图' },
    '工具台景': { cover: 'workbench.webp', alt: '工具台景场景示意图' },
    '木纹台面-厨房景': { cover: 'wood-kitchen.webp', alt: '木纹台面厨房景场景示意图' },
    '儿童房景/户外下午茶景': { cover: 'kids-room.webp', covers: ['kids-room.webp', 'garden.webp'], alt: '儿童房景与户外下午茶景场景示意图' },
    '洗衣房景别': {
        src: 'assets/real-studio/laundry.webp?v=20260804-laundry-reference',
        cover: 'laundry-cover.webp',
        alt: '洗衣房景别场景示意图'
    },
    '浴室景': { cover: 'bathroom.webp', alt: '浴室景场景示意图' },
    '黑色台面-厨房景': { cover: 'black-kitchen.webp', alt: '黑色台面厨房景场景示意图' },

    // 6F 实景棚：21 个景都不铺实拍照片，统一用身份色柔光。
};

function getSceneReference(studioId) {
    const reference = STUDIO_SCENE_REFERENCES[studioId];
    if (!reference) return null;
    return {
        ...reference,
        coverSrc: reference.cover
            ? `assets/real-studio/${reference.cover}?v=${SCENE_COVER_VERSION}`
            : null,
        coverSrcs: reference.covers
            ? reference.covers.map(cover => `assets/real-studio/${cover}?v=${SCENE_COVER_VERSION}`)
            : reference.cover
                ? [`assets/real-studio/${reference.cover}?v=${SCENE_COVER_VERSION}`]
                : []
    };
}

const STUDIO_SCENE_TITLE_LINES = {
    '洗衣房景别': ['洗衣房', '景别'],
    '木纹台面-厨房景': ['木纹台面', '厨房景'],
    '黑色台面-厨房景': ['黑色台面', '厨房景'],
    '儿童房景/户外下午茶景': ['儿童房景', '户外下午茶景']
};

function renderStudioSceneTitle(title) {
    const lines = STUDIO_SCENE_TITLE_LINES[title] || [title];
    return `<h4 aria-label="${escapeHtml(title)}">${lines
        .map(line => `<span class="preview-scene-title-line" aria-hidden="true">${escapeHtml(line)}</span>`)
        .join('')}</h4>`;
}

const SIXTH_FLOOR_CANVAS_SIZE = { width: 3280, height: 1560 };
const SIXTH_FLOOR_FRAME_INSETS = { top: 76, right: 20, bottom: 20, left: 20 };
const SIXTH_FLOOR_DEFAULT_SCALE = 0.75;
// 按最终确认截图固化位置和尺寸，不再读取个人布局或允许调整卡片。
const SIXTH_FLOOR_DEFAULT_LAYOUT = {
    'sixth-corridor': { x: 48, y: 40, width: 626, height: 352 },
    'sixth-wood-wall': { x: 394, y: 440, width: 293, height: 489 },
    'sixth-greenery-wall': { x: 0, y: 468, width: 361, height: 893 },
    'sixth-ocean-wall': { x: 711, y: 683, width: 859, height: 172 },
    'sixth-street': { x: 1948, y: 662, width: 1054, height: 193 },
    'sixth-greenery': { x: 394, y: 986, width: 293, height: 502 },
    'sixth-kids': { x: 711, y: 40, width: 350, height: 587 },
    'sixth-classroom': { x: 1094, y: 40, width: 476, height: 296 },
    'sixth-study': { x: 1598, y: 40, width: 320, height: 587 },
    'sixth-vintage-dining': { x: 1954, y: 40, width: 341, height: 587 },
    'sixth-clinic': { x: 1094, y: 360, width: 476, height: 267 },
    'sixth-modern-living': { x: 2337, y: 40, width: 304, height: 587 },
    'sixth-modern-dining': { x: 2674, y: 40, width: 328, height: 587 },
    'sixth-outdoor-cafe': { x: 1598, y: 683, width: 320, height: 172 },
    'sixth-bedroom': { x: 711, y: 916, width: 430, height: 572 },
    'sixth-bathroom': { x: 1159, y: 907, width: 411, height: 581 },
    'sixth-bar': { x: 1598, y: 907, width: 320, height: 581 },
    'sixth-chinese': { x: 1950, y: 907, width: 302, height: 581 },
    'sixth-workshop': { x: 2280, y: 907, width: 361, height: 581 },
    'sixth-modern-kitchen': { x: 2674, y: 907, width: 328, height: 581 },
    'sixth-tea-room': { x: 3039, y: 40, width: 224, height: 815 },
    'fifth-balcony': { x: 3033, y: 955, width: 230, height: 491 }
};

let sixthFloorViewport = { x: 0, y: 0, scale: 1 };

function loadSixthFloorLayout() {
    return structuredClone(SIXTH_FLOOR_DEFAULT_LAYOUT);
}

let currentStudioFloor = null;
currentStudioCategory = null;

initStudioUI = function initStudioLayoutUI() {
    const savedView = loadStudioViewPreference();
    currentStudioFloor = savedView.floor;
    currentStudioCategory = savedView.category;
    baseInitStudioUI();
};

function getStudioViewStorageKey() {
    return `studio-view:${currentUser || '游客'}`;
}

function loadStudioViewPreference() {
    try {
        const savedView = JSON.parse(localStorage.getItem(getStudioViewStorageKey()) || 'null');
        if (['6F', '7F'].includes(savedView?.floor) && ['cyclorama', 'real-scene'].includes(savedView?.category)) {
            return savedView;
        }
    } catch {
        // 使用默认视图。
    }
    return { floor: '6F', category: 'cyclorama' };
}

const STUDIO_FLOORS = ['6F', '7F'];
const STUDIO_CATEGORIES = [
    { value: 'cyclorama', label: '无影棚' },
    { value: 'real-scene', label: '实景棚' }
];

function renderStudioVenueOption({ label, isActive, action }) {
    return `<button type="button" class="studio-venue-option${isActive ? ' active' : ''}" aria-pressed="${isActive}" onclick="${action}">${label}</button>`;
}

// 楼层和棚型常驻在工具栏中，点击一项只切换对应维度。
function renderStudioVenuePicker() {
    const floorOptions = STUDIO_FLOORS
        .map(floor => renderStudioVenueOption({
            label: floor,
            isActive: currentStudioFloor === floor,
            action: `selectStudioView('${floor}', currentStudioCategory)`
        }))
        .join('');
    const categoryOptions = STUDIO_CATEGORIES
        .map(category => renderStudioVenueOption({
            label: category.label,
            isActive: currentStudioCategory === category.value,
            action: `selectStudioView(currentStudioFloor, '${category.value}')`
        }))
        .join('');

    return `
        <div class="studio-venue-picker" role="group" aria-label="选择楼层和影棚类型">
            <div class="studio-venue-row" role="group" aria-label="楼层">
                <div class="studio-venue-options">${floorOptions}</div>
            </div>
            <div class="studio-venue-row" role="group" aria-label="棚型">
                <div class="studio-venue-options">${categoryOptions}</div>
            </div>
        </div>
    `;
}

function renderStudioToolbarControls() {
    const toolbarControls = document.getElementById('studioToolbarControls');
    if (!toolbarControls) return;
    toolbarControls.innerHTML = `
        ${renderStudioVenuePicker()}
    `;
}

function renderPreviewStatusLegend() {
    return `
        <div class="preview-status-legend" aria-label="预约状态颜色说明">
            <span class="preview-legend-item"><i class="preview-legend-swatch available"></i>可预约</span>
            <span class="preview-legend-item"><i class="preview-legend-swatch partial"></i>部分预约</span>
            <span class="preview-legend-item"><i class="preview-legend-swatch full"></i>已约满</span>
        </div>
    `;
}

function selectStudioView(floor, category) {
    if (!['6F', '7F'].includes(floor) || !['cyclorama', 'real-scene'].includes(category)) return;
    if (currentView !== 'list') switchView('list');
    if (floor === currentStudioFloor && category === currentStudioCategory) return;
    currentStudioFloor = floor;
    currentStudioCategory = category;
    localStorage.setItem(getStudioViewStorageKey(), JSON.stringify({ floor, category }));
    // 6F 实景棚能提前一周约，其余视图只有今天/明天。
    // 从 6F 实景棚切走时，原来选的日期可能已经超出新视图的范围，收回到今天。
    if (selectedDate && !isSelectableDate(selectedDate, {
        isAdmin: currentUser === 'admin',
        windowDays: getActiveBookingWindowDays()
    })) {
        selectedDate = getChinaDate();
    }
    renderBookingDateSwitcher();
    renderStudioToolbarControls();
    renderStudioSections();
    renderBookings();
}

renderStudioSections = function renderStudioLayoutSections() {
    const container = document.getElementById('studioGroups');
    if (!container) return;
    renderStudioToolbarControls();

    const listView = document.getElementById('listView');
    if (!currentStudioFloor || !currentStudioCategory) {
        listView?.classList.remove('preview-cyclorama-active', 'preview-sixth-floor-active', 'real-scene-active');
        container.innerHTML = '';
        return;
    }

    const isCyclorama = currentStudioCategory === 'cyclorama';
    listView?.classList.toggle('preview-cyclorama-active', isCyclorama);
    listView?.classList.toggle('preview-sixth-floor-active', isCyclorama && currentStudioFloor === '6F');

    if (currentStudioCategory !== 'real-scene') {
        baseRenderStudioSections();

        container.querySelector('.studio-category-tabs')?.remove();
        const studioMap = container.querySelector('.studio-map');
        const seventhFloorZone = container.querySelector('.studio-map-zone-seventh-floor');
        const sixthFloorZone = container.querySelector('.studio-map-zone-sixth-floor');

        if (currentStudioFloor === '7F') {
            sixthFloorZone?.remove();
            seventhFloorZone?.querySelector('.studio-floor-header')?.remove();
        } else {
            seventhFloorZone?.remove();
            sixthFloorZone?.querySelector('.studio-map-zone-header')?.remove();
            sixthFloorZone?.querySelector('.studio-section-header')?.remove();
        }

        studioMap?.classList.add('preview-single-floor-map');
        return;
    }

    document.getElementById('listView')?.classList.add('real-scene-active', 'studio-layout-active');

    container.innerHTML = `
        <section class="preview-workspace preview-workspace-${currentStudioFloor.toLowerCase()}">
            ${currentStudioFloor === '6F' ? '' : renderPreviewStatusLegend()}
            <div id="studioPreviewContent" class="preview-content"></div>
        </section>
    `;
    renderRealSceneOverview();
};

renderBookings = function renderStudioLayoutBookings() {
    if (!currentStudioFloor || !currentStudioCategory) return;

    if (currentStudioCategory !== 'real-scene') {
        document.getElementById('listView')?.classList.add('studio-layout-active');
        baseRenderBookings();
        return;
    }

    renderRealSceneOverview();
};

function getRealSceneStudios() {
    return getAllStudios().filter(studio =>
        studio.category === 'real-scene'
        && (currentStudioFloor === '6F' ? studio.groupKey === 'real-scene-sixth-floor' : studio.groupKey === 'real-scene')
    );
}

function getStudioOverviewDate() {
    return getDisplayDates()[0] || getChinaDate();
}

function getRealSceneState(studio, date) {
    const bookings = getStudioBookingsForDates(studio.id, [date]);
    const availableRanges = BOOKABLE_PERIODS.flatMap(period =>
        getAvailableTimeRanges(period, date, bookings)
    );
    const totalBookableMinutes = BOOKABLE_PERIODS.reduce(
        (total, period) => total + timeToMinutes(period.end) - timeToMinutes(period.start),
        0
    );
    const totalSlots = Math.round(totalBookableMinutes / BOOKING_INTERVAL_MINUTES);
    const availableSlots = availableRanges.reduce(
        (total, range) => total + (timeToMinutes(range.end) - timeToMinutes(range.start)) / BOOKING_INTERVAL_MINUTES,
        0
    );
    const remainingSegments = totalSlots > 0
        ? Math.min(
            STUDIO_OVERVIEW_SEGMENTS,
            Math.max(availableSlots > 0 ? 1 : 0, Math.round((availableSlots / totalSlots) * STUDIO_OVERVIEW_SEGMENTS))
        )
        : 0;
    const occupiedSegments = STUDIO_OVERVIEW_SEGMENTS - remainingSegments;
    const occupiedPercentage = Math.round((occupiedSegments / STUDIO_OVERVIEW_SEGMENTS) * 100);
    const isPastDate = date < getChinaDate();
    const lastBookableStart = minutesToTime(timeToMinutes(BOOKING_END_TIME) - BOOKING_INTERVAL_MINUTES);
    const isEndedToday = date === getChinaDate() && getChinaCurrentTime() > lastBookableStart;

    if (isPastDate || isEndedToday) {
        return {
            type: 'ended',
            label: '已过期',
            bookings,
            availableRanges: [],
            remainingSegments,
            occupiedSegments,
            occupiedPercentage,
            totalSegments: STUDIO_OVERVIEW_SEGMENTS
        };
    }
    if (availableRanges.length === 0) {
        return { type: 'full', label: '已约满', bookings, availableRanges, remainingSegments: 0, occupiedSegments: STUDIO_OVERVIEW_SEGMENTS, occupiedPercentage: 100, totalSegments: STUDIO_OVERVIEW_SEGMENTS };
    }
    if (bookings.length > 0) {
        return { type: 'partial', label: '部分预约', bookings, availableRanges, remainingSegments, occupiedSegments, occupiedPercentage, totalSegments: STUDIO_OVERVIEW_SEGMENTS };
    }
    return { type: 'available', label: '可预约', bookings, availableRanges, remainingSegments, occupiedSegments, occupiedPercentage, totalSegments: STUDIO_OVERVIEW_SEGMENTS };
}


function renderRealSceneOverview() {
    const content = document.getElementById('studioPreviewContent');
    if (!content) return;

    const date = getStudioOverviewDate();
    const scenes = getRealSceneStudios().map(studio => ({
        studio,
        state: getRealSceneState(studio, date)
    }));

    content.className = `preview-content preview-content-${currentStudioFloor.toLowerCase()}`;
    content.innerHTML = renderRealSceneMap(scenes);
    if (currentStudioFloor === '6F') bindSixthFloorCanvas();
}

function renderRealSceneMap(scenes) {
    const floorClass = currentStudioFloor === '6F' ? ' preview-floor-map-sixth-floor' : '';
    const isSixthFloor = currentStudioFloor === '6F';
    const layout = isSixthFloor ? loadSixthFloorLayout() : null;
    return `
        <div class="preview-floor-map${floorClass}" aria-label="${currentStudioFloor} 实景棚平面总览">
            ${isSixthFloor ? `
                <div class="sixth-floor-canvas-viewport" data-canvas-viewport>
                    ${renderPreviewStatusLegend()}
                    <div class="sixth-floor-canvas" data-sixth-floor-canvas style="width:${SIXTH_FLOOR_CANVAS_SIZE.width}px;height:${SIXTH_FLOOR_CANVAS_SIZE.height}px;transform:translate(calc(-50% + ${sixthFloorViewport.x}px), calc(-50% + ${sixthFloorViewport.y}px)) scale(${sixthFloorViewport.scale})">
                        ${scenes.map(({ studio, state }, index) => renderRealSceneCard(studio, state, index, layout)).join('')}
                    </div>
                </div>
            ` : scenes.map(({ studio, state }, index) => renderRealSceneCard(studio, state, index)).join('')}
        </div>
    `;
}

function renderRealSceneCard(studio, state, index, layout = null) {
    const reference = getSceneReference(studio.id);
    const position = layout?.[studio.mapArea];
    // 细高的竖列卡片（高 ≥ 宽的两倍）横排文字只能挤在中间一小段，
    // 改成竖排后字能顺着卡片的长边排开，见 .is-vertical-title。
    const verticalTitle = Boolean(position && position.height >= position.width * 2);
    // 只有完全没被预约的景才铺实拍照片。一旦有人约了，就换回纯色状态卡
    // （浅蓝=部分预约 / 中蓝=已约满 / 灰=已过期）。
    // 照片和纯色是两种截然不同的东西，扫一眼就能分出哪些还能约，
    // 比让用户去比较"哪张照片更暗"可靠得多。
    // 照片按"还能不能约"划线，而不是"约没约过"：
    // 可预约 + 部分预约都还能约 → 保留实拍照片，让人看得见场景再决定；
    // 已约满 + 已过期约不了了 → 换成纯色卡，直接从选择里排除掉。
    // 部分预约的状态色不铺满卡面，只留在边框和进度条上——色层蒙在照片上会发脏，
    // 暖色场景（酒吧、小木屋、木纹厨房）尤其容易糊成一片。
    const isSeventhFloor = currentStudioFloor === '7F';
    const showCover = Boolean(reference?.coverSrc)
        && (isSeventhFloor || state.type === 'available' || state.type === 'partial');
    return `
        <article
            class="preview-scene-card ${state.type}${state.bookings.length > 0 ? ' has-progress' : ''}${reference?.src ? ' has-scene-reference' : ''}${showCover ? ' has-scene-cover' : ''}${position ? ' sixth-floor-layout-card' : ''}${verticalTitle ? ' is-vertical-title' : ''}"
            data-map-area="${escapeHtml(studio.mapArea)}"
            data-studio-id="${escapeHtml(studio.id)}"
            ${position ? `style="--preview-index:${index};--card-x:${position.x}px;--card-y:${position.y}px;--card-width:${position.width}px;--card-height:${position.height}px"` : ''}
            ${position ? `data-layout-key="${escapeHtml(studio.mapArea)}"` : ''}
            onclick="handleSixthFloorCardClick(event, '${escapeHtml(studio.id)}')"
            onkeydown="handleRealSceneCardKeydown(event, '${escapeHtml(studio.id)}')"
            role="button"
            tabindex="0"
        >
            ${showCover ? `
                <div class="preview-scene-cover-group" aria-hidden="true">
                    ${reference.coverSrcs.map(src => `
                        <img
                            class="preview-scene-cover"
                            src="${escapeHtml(src)}"
                            alt=""
                            loading="lazy"
                            decoding="async"
                        >
                    `).join('')}
                </div>
            ` : ''}
            <div class="preview-scene-info">
                <div class="preview-scene-card-top">
                    ${renderStudioSceneTitle(studio.title)}
                </div>
                ${state.type === 'ended' ? `
                    <span class="preview-scene-expired-label" role="status">已过期</span>
                ` : state.bookings.length > 0 && state.type === 'full' ? `
                    <span class="preview-scene-full-label" role="status" aria-label="当前日期已约满">已约满</span>
                ` : state.bookings.length > 0 ? `
                    <div
                        class="preview-scene-progress"
                        role="progressbar"
                        aria-label="当前日期已预约时段"
                        aria-valuemin="0"
                        aria-valuemax="${state.totalSegments}"
                        aria-valuenow="${state.occupiedSegments}"
                        title="已预约 ${state.occupiedSegments} 个时段，剩余 ${state.remainingSegments} 个"
                    >
                        <span class="preview-scene-progress-track"><i style="width:${state.occupiedPercentage}%"></i></span>
                        <small>${state.remainingSegments}/${state.totalSegments}</small>
                    </div>
                ` : ''}
            </div>
            ${reference?.src ? `
                <figure class="preview-scene-reference-popover" aria-hidden="true">
                    <img src="${escapeHtml(reference.src)}" alt="${escapeHtml(reference.alt)}" decoding="async">
                </figure>
            ` : ''}
        </article>
    `;
}

function handleSixthFloorCardClick(event, studioId) {
    openRealSceneCard(studioId);
}

function applySixthFloorViewport() {
    const canvas = document.querySelector('[data-sixth-floor-canvas]');
    if (!canvas) return;
    canvas.style.transform = `translate(calc(-50% + ${sixthFloorViewport.x}px), calc(-50% + ${sixthFloorViewport.y}px)) scale(${sixthFloorViewport.scale})`;
}

function getSixthFloorLayoutBounds(layout) {
    const cards = Object.values(layout);
    const minX = Math.min(...cards.map(card => card.x));
    const minY = Math.min(...cards.map(card => card.y));
    const maxX = Math.max(...cards.map(card => card.x + card.width));
    const maxY = Math.max(...cards.map(card => card.y + card.height));
    return { width: maxX - minX, height: maxY - minY };
}

function fitSixthFloorCanvasToViewport(layout) {
    const viewport = document.querySelector('[data-canvas-viewport]');
    if (!viewport) return;
    const bounds = getSixthFloorLayoutBounds(layout);
    const availableWidth = Math.max(viewport.clientWidth - SIXTH_FLOOR_FRAME_INSETS.left - SIXTH_FLOOR_FRAME_INSETS.right, 320);
    const availableHeight = Math.max(viewport.clientHeight - SIXTH_FLOOR_FRAME_INSETS.top - SIXTH_FLOOR_FRAME_INSETS.bottom, 320);
    const widthScale = availableWidth / bounds.width;
    const heightScale = availableHeight / bounds.height;
    const fittedScale = Math.min(SIXTH_FLOOR_DEFAULT_SCALE, widthScale, heightScale);
    sixthFloorViewport = { ...sixthFloorViewport, scale: Number(fittedScale.toFixed(3)) };
    applySixthFloorViewport();
}

function bindSixthFloorCanvas() {
    const viewport = document.querySelector('[data-canvas-viewport]');
    const canvas = document.querySelector('[data-sixth-floor-canvas]');
    if (!viewport || !canvas) return;
    // 布局固定，画布只按视口自动等比适配，不再提供手动缩放或平移。
    fitSixthFloorCanvasToViewport(loadSixthFloorLayout());
}

function openRealSceneCard(studioId) {
    const overviewDate = getStudioOverviewDate();
    const studio = getStudioById(studioId);
    const state = studio ? getRealSceneState(studio, overviewDate) : null;
    if (state?.type === 'ended') {
        const targetDate = overviewDate < getChinaDate() && getChinaCurrentTime() <= BOOKING_END_TIME
            ? getChinaDate()
            : getChinaDate(1);
        selectBookingDate(targetDate);
        showToast(`当前日期已过期，已为你切换到${formatShortDate(targetDate)}`, 'success');
    }
    showAddBookingForm(studioId);
}

function handleRealSceneCardKeydown(event, studioId) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openRealSceneCard(studioId);
}




