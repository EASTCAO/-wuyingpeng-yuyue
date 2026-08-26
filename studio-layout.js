const baseRenderStudioSections = renderStudioSections;
const baseRenderBookings = renderBookings;
const baseInitStudioUI = initStudioUI;
const STUDIO_OVERVIEW_SEGMENTS = 18;
// 实拍封面。照片比抽象渐变更能说明"这是哪个景"，而且不会和橙色的预约状态争语义。
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
    '儿童房景/户外下午茶景': { cover: 'kids-tea.webp', alt: '儿童房景与户外下午茶景场景示意图' },
    '洗衣房景别': {
        src: 'assets/real-studio/laundry.webp?v=20260804-laundry-reference',
        cover: 'laundry-cover.webp',
        alt: '洗衣房景别场景示意图'
    },
    '浴室景': { cover: 'bathroom.webp', alt: '浴室景场景示意图' },
    '黑色台面-厨房景': { cover: 'black-kitchen.webp', alt: '黑色台面厨房景场景示意图' },

    // 6F 实景棚：洗浴室景复用 7F 浴室的同一张素材（同类场景）。
    // 其余 20 个景暂无素材，继续用身份色柔光，两种风格可以共存。
    '6F·洗浴室景': { cover: 'bathroom.webp', alt: '洗浴室景场景示意图' }
};

function getSceneReference(studioId) {
    const reference = STUDIO_SCENE_REFERENCES[studioId];
    if (!reference) return null;
    return {
        ...reference,
        coverSrc: reference.cover
            ? `assets/real-studio/${reference.cover}?v=${SCENE_COVER_VERSION}`
            : null
    };
}

const SIXTH_FLOOR_LAYOUT_VERSION = 6;
const SIXTH_FLOOR_CANVAS_SIZE = { width: 1800, height: 1040 };
const SIXTH_FLOOR_FRAME_INSETS = { top: 76, right: 20, bottom: 20, left: 20 };
const SIXTH_FLOOR_DEFAULT_SCALE = 0.75;
// 缩放下限。原来是 0.55，此时 16px 的景名会被缩到 8.8px，基本不可读；
// 0.7 对应 11.2px，窗口再小宁可出现滚动条拖着看，也不把字缩没。
const SIXTH_FLOOR_MIN_SCALE = 0.7;
const SIXTH_FLOOR_DRAG_THRESHOLD = 10;
// 默认户型图坐标。用间距分级代替均匀网格：同一功能带内 24px、带与带之间 64px，
// 布局靠疏密自己分块，而不是靠一张 40px 均匀网格把 21 个景摊平。
//
// 三条带：背景墙/通道（y40）、房间（y224-800）、功能间（y864）。
// 顶排和底排都不做等分，且两排列位刻意错开（只在 x40 / x1760 两端对齐），
// 免得上下两条等宽栅栏把中段夹成三明治。
// 左右各留一根通高柱（绿植房景 240 宽、复古餐厅景 320 宽）收边。
// 每行宽度之和都精确等于 1720，右沿严丝合缝落在 x1760。
// 改过坐标就升 SIXTH_FLOOR_LAYOUT_VERSION，让残留的旧版个人布局作废。
const SIXTH_FLOOR_DEFAULT_LAYOUT = {
    'sixth-corridor': { x: 40, y: 40, width: 264, height: 120 },
    'sixth-wood-wall': { x: 328, y: 40, width: 264, height: 120 },
    'sixth-greenery-wall': { x: 616, y: 40, width: 360, height: 120 },
    'sixth-ocean-wall': { x: 1000, y: 40, width: 360, height: 120 },
    'sixth-street': { x: 1384, y: 40, width: 376, height: 120 },
    'sixth-greenery': { x: 40, y: 224, width: 240, height: 576 },
    'sixth-kids': { x: 304, y: 224, width: 240, height: 160 },
    'sixth-classroom': { x: 568, y: 224, width: 264, height: 160 },
    'sixth-study': { x: 856, y: 224, width: 264, height: 344 },
    'sixth-vintage-living': { x: 1144, y: 224, width: 272, height: 344 },
    'sixth-vintage-dining': { x: 1440, y: 224, width: 320, height: 576 },
    'sixth-clinic': { x: 304, y: 408, width: 528, height: 160 },
    'sixth-modern-living': { x: 304, y: 592, width: 264, height: 208 },
    'sixth-modern-dining': { x: 592, y: 592, width: 264, height: 208 },
    'sixth-outdoor-cafe': { x: 880, y: 592, width: 264, height: 208 },
    'sixth-bedroom': { x: 1168, y: 592, width: 248, height: 208 },
    'sixth-bathroom': { x: 40, y: 864, width: 336, height: 140 },
    'sixth-bar': { x: 400, y: 864, width: 288, height: 140 },
    'sixth-chinese': { x: 712, y: 864, width: 288, height: 140 },
    'sixth-workshop': { x: 1024, y: 864, width: 336, height: 140 },
    'sixth-modern-kitchen': { x: 1384, y: 864, width: 376, height: 140 }
};

let sixthFloorViewport = { x: 0, y: 0, scale: 1 };
let sixthFloorDragState = null;
let sixthFloorSuppressClick = false;

function getSixthFloorLayoutStorageKey() {
    return `studio-layout:6F:${currentUser || '游客'}`;
}

function canEditSixthFloorLayout() {
    return Boolean(currentUser && !currentUser.startsWith('游客'));
}

function clampSixthFloorCardPosition(card) {
    return {
        ...card,
        x: Math.max(0, Math.min(SIXTH_FLOOR_CANVAS_SIZE.width - card.width, card.x)),
        y: Math.max(0, Math.min(SIXTH_FLOOR_CANVAS_SIZE.height - card.height, card.y))
    };
}

function clampSixthFloorLayout(layout) {
    return Object.fromEntries(Object.entries(layout).map(([key, card]) => [key, clampSixthFloorCardPosition(card)]));
}

function loadSixthFloorLayout() {
    if (!canEditSixthFloorLayout()) return clampSixthFloorLayout(structuredClone(SIXTH_FLOOR_DEFAULT_LAYOUT));
    try {
        const stored = JSON.parse(localStorage.getItem(getSixthFloorLayoutStorageKey()) || 'null');
        return clampSixthFloorLayout(stored?.version === SIXTH_FLOOR_LAYOUT_VERSION && stored.layout
            ? { ...structuredClone(SIXTH_FLOOR_DEFAULT_LAYOUT), ...stored.layout }
            : structuredClone(SIXTH_FLOOR_DEFAULT_LAYOUT));
    } catch {
        return clampSixthFloorLayout(structuredClone(SIXTH_FLOOR_DEFAULT_LAYOUT));
    }
}

function saveSixthFloorLayout(layout) {
    if (!canEditSixthFloorLayout()) return;
    localStorage.setItem(getSixthFloorLayoutStorageKey(), JSON.stringify({ version: SIXTH_FLOOR_LAYOUT_VERSION, layout }));
}

function resetSixthFloorLayout() {
    if (!canEditSixthFloorLayout()) return;
    localStorage.removeItem(getSixthFloorLayoutStorageKey());
    sixthFloorViewport = { x: 0, y: 0, scale: 1 };
    renderRealSceneOverview();
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

function renderStudioViewTabs() {
    const views = [
        { floor: '6F', category: 'cyclorama', label: '6F · 无影棚' },
        { floor: '6F', category: 'real-scene', label: '6F · 实景棚' },
        { floor: '7F', category: 'cyclorama', label: '7F · 无影棚' },
        { floor: '7F', category: 'real-scene', label: '7F · 实景棚' }
    ];
    return `
        <div class="studio-view-tabs" role="tablist" aria-label="选择楼层和影棚类型">
            ${views.map(view => {
                const isActive = currentStudioFloor === view.floor && currentStudioCategory === view.category;
                return `<button type="button" class="studio-view-tab${isActive ? ' active' : ''}" onclick="selectStudioView('${view.floor}', '${view.category}')" role="tab" aria-selected="${isActive}">${view.label}</button>`;
            }).join('')}
        </div>
    `;
}

function renderStudioToolbarControls() {
    const toolbarControls = document.getElementById('studioToolbarControls');
    if (!toolbarControls) return;
    toolbarControls.innerHTML = `
        ${renderStudioViewTabs()}
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
                    ${canEditSixthFloorLayout() ? `<div class="sixth-floor-canvas-toolbar" aria-label="画布工具">
                        <button type="button" data-canvas-action="zoom-out" aria-label="缩小">−</button>
                        <span data-canvas-zoom>100%</span>
                        <button type="button" data-canvas-action="zoom-in" aria-label="放大">+</button>
                        <button type="button" data-canvas-action="reset">复位</button>
                    </div>` : ''}
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
    const editable = Boolean(position && canEditSixthFloorLayout());
    // 只有完全没被预约的景才铺实拍照片。一旦有人约了，就换回纯色状态卡
    // （浅橙=部分预约 / 中橙=已约满 / 灰=已过期）。
    // 照片和纯色是两种截然不同的东西，扫一眼就能分出哪些还能约，
    // 比让用户去比较"哪张照片更暗"可靠得多。
    // 照片按"还能不能约"划线，而不是"约没约过"：
    // 可预约 + 部分预约都还能约 → 保留实拍照片，让人看得见场景再决定；
    // 已约满 + 已过期约不了了 → 换成纯色卡，直接从选择里排除掉。
    // 部分预约的橙色不铺满卡面，只留在边框和进度条上——橙色蒙在照片上会发脏，
    // 暖色场景（酒吧、小木屋、木纹厨房）尤其容易糊成一片。
    const showCover = Boolean(reference?.coverSrc)
        && (state.type === 'available' || state.type === 'partial');
    return `
        <article
            class="preview-scene-card ${state.type}${state.bookings.length > 0 ? ' has-progress' : ''}${reference?.src ? ' has-scene-reference' : ''}${showCover ? ' has-scene-cover' : ''}${position ? ' sixth-floor-layout-card' : ''}"
            data-map-area="${escapeHtml(studio.mapArea)}"
            data-studio-id="${escapeHtml(studio.id)}"
            ${position ? `style="--preview-index:${index};--card-x:${position.x}px;--card-y:${position.y}px;--card-width:${position.width}px;--card-height:${position.height}px"` : ''}
            ${position ? `data-layout-key="${escapeHtml(studio.mapArea)}"` : ''}
            onclick="handleSixthFloorCardClick(event, '${escapeHtml(studio.id)}')"
            ${editable ? 'data-draggable="true"' : ''}
            onkeydown="handleRealSceneCardKeydown(event, '${escapeHtml(studio.id)}')"
            role="button"
            tabindex="0"
        >
            ${showCover ? `
                <img
                    class="preview-scene-cover"
                    src="${escapeHtml(reference.coverSrc)}"
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                >
            ` : ''}
            <div class="preview-scene-card-top">
                <h4>${escapeHtml(studio.title)}</h4>
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
            ${reference?.src ? `
                <figure class="preview-scene-reference-popover" aria-hidden="true">
                    <img src="${escapeHtml(reference.src)}" alt="${escapeHtml(reference.alt)}" decoding="async">
                </figure>
            ` : ''}
        </article>
    `;
}

function handleSixthFloorCardClick(event, studioId) {
    if (sixthFloorSuppressClick) {
        sixthFloorSuppressClick = false;
        event.preventDefault();
        return;
    }
    openRealSceneCard(studioId);
}

function applySixthFloorViewport() {
    const canvas = document.querySelector('[data-sixth-floor-canvas]');
    if (!canvas) return;
    canvas.style.transform = `translate(calc(-50% + ${sixthFloorViewport.x}px), calc(-50% + ${sixthFloorViewport.y}px)) scale(${sixthFloorViewport.scale})`;
    const zoom = document.querySelector('[data-canvas-zoom]');
    if (zoom) zoom.textContent = `${Math.round(sixthFloorViewport.scale * 100)}%`;
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
    sixthFloorViewport = { ...sixthFloorViewport, scale: Number(Math.max(SIXTH_FLOOR_MIN_SCALE, fittedScale).toFixed(2)) };
    applySixthFloorViewport();
}

function bindSixthFloorCanvas() {
    const viewport = document.querySelector('[data-canvas-viewport]');
    const canvas = document.querySelector('[data-sixth-floor-canvas]');
    if (!viewport || !canvas) return;
    const layout = loadSixthFloorLayout();
    fitSixthFloorCanvasToViewport(layout);
    if (!canEditSixthFloorLayout()) return;
    viewport.addEventListener('wheel', event => {
        event.preventDefault();
        const delta = event.deltaY < 0 ? 0.1 : -0.1;
        sixthFloorViewport.scale = Math.min(1.5, Math.max(SIXTH_FLOOR_MIN_SCALE, Number((sixthFloorViewport.scale + delta).toFixed(2))));
        applySixthFloorViewport();
    }, { passive: false });
    viewport.querySelectorAll('[data-canvas-action]').forEach(button => button.addEventListener('click', () => {
        const action = button.dataset.canvasAction;
        if (action === 'reset') return resetSixthFloorLayout();
        sixthFloorViewport.scale = Math.min(1.5, Math.max(SIXTH_FLOOR_MIN_SCALE, Number((sixthFloorViewport.scale + (action === 'zoom-in' ? 0.1 : -0.1)).toFixed(2))));
        applySixthFloorViewport();
    }));
    canvas.addEventListener('pointerdown', event => {
        const card = event.target.closest('[data-draggable="true"]');
        if (card) {
            const key = card.dataset.layoutKey;
            const start = layout[key];
            sixthFloorDragState = { type: 'card', card, key, startX: event.clientX, startY: event.clientY, originX: start.x, originY: start.y, moved: false };
        } else if (!event.target.closest('.sixth-floor-canvas-toolbar')) {
            sixthFloorDragState = { type: 'canvas', startX: event.clientX, startY: event.clientY, originX: sixthFloorViewport.x, originY: sixthFloorViewport.y, moved: false };
        }
        if (sixthFloorDragState) viewport.setPointerCapture(event.pointerId);
    });
    viewport.addEventListener('pointermove', event => {
        if (!sixthFloorDragState) return;
        const state = sixthFloorDragState;
        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        if (!state.moved && Math.hypot(dx, dy) < SIXTH_FLOOR_DRAG_THRESHOLD) return;
        state.moved = true;
        if (state.type === 'card') {
            const next = layout[state.key];
            const bounded = clampSixthFloorCardPosition({
                ...next,
                x: Math.round((state.originX + dx / sixthFloorViewport.scale) / 12) * 12,
                y: Math.round((state.originY + dy / sixthFloorViewport.scale) / 12) * 12
            });
            next.x = bounded.x;
            next.y = bounded.y;
            state.card.style.setProperty('--card-x', `${next.x}px`);
            state.card.style.setProperty('--card-y', `${next.y}px`);
            state.card.classList.add('is-dragging');
        } else {
            sixthFloorViewport.x = state.originX + dx;
            sixthFloorViewport.y = state.originY + dy;
            applySixthFloorViewport();
        }
    });
    viewport.addEventListener('pointerup', event => {
        const state = sixthFloorDragState;
        if (!state) return;
        if (state.type === 'card') {
            state.card.classList.remove('is-dragging');
            if (state.moved) {
                sixthFloorSuppressClick = true;
                saveSixthFloorLayout(layout);
                setTimeout(() => {
                    sixthFloorSuppressClick = false;
                }, 0);
            } else {
                sixthFloorSuppressClick = true;
                openRealSceneCard(state.card.dataset.studioId);
                setTimeout(() => {
                    sixthFloorSuppressClick = false;
                }, 0);
            }
        }
        sixthFloorDragState = null;
        if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    });
    viewport.addEventListener('pointercancel', event => {
        const state = sixthFloorDragState;
        if (!state) return;
        if (state.type === 'card') state.card.classList.remove('is-dragging');
        sixthFloorDragState = null;
        if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    });
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
