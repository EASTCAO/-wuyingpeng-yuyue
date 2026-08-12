const baseRenderStudioSections = renderStudioSections;
const baseRenderBookings = renderBookings;
const STUDIO_OVERVIEW_SEGMENTS = 18;
const STUDIO_SCENE_REFERENCES = {
    '洗衣房景别': {
        src: 'assets/real-studio/laundry.webp?v=20260804-laundry-reference',
        alt: '洗衣房景别场景示意图'
    }
};

const SIXTH_FLOOR_LAYOUT_VERSION = 3;
const SIXTH_FLOOR_CANVAS_SIZE = { width: 1800, height: 900 };
const SIXTH_FLOOR_DEFAULT_LAYOUT = {
    'sixth-corridor': { x: 40, y: 40, width: 320, height: 100 },
    'sixth-wood-wall': { x: 400, y: 40, width: 320, height: 100 },
    'sixth-greenery-wall': { x: 760, y: 40, width: 320, height: 100 },
    'sixth-ocean-wall': { x: 1120, y: 40, width: 320, height: 100 },
    'sixth-street': { x: 1480, y: 40, width: 280, height: 100 },
    'sixth-greenery': { x: 40, y: 170, width: 200, height: 500 },
    'sixth-kids': { x: 280, y: 170, width: 220, height: 130 },
    'sixth-classroom': { x: 540, y: 170, width: 260, height: 130 },
    'sixth-clinic': { x: 280, y: 320, width: 520, height: 130 },
    'sixth-study': { x: 840, y: 170, width: 260, height: 280 },
    'sixth-vintage-living': { x: 1140, y: 170, width: 260, height: 280 },
    'sixth-vintage-dining': { x: 1440, y: 170, width: 320, height: 280 },
    'sixth-modern-living': { x: 280, y: 480, width: 260, height: 150 },
    'sixth-modern-dining': { x: 580, y: 480, width: 260, height: 150 },
    'sixth-outdoor-cafe': { x: 880, y: 480, width: 260, height: 150 },
    'sixth-bedroom': { x: 1180, y: 480, width: 320, height: 150 },
    'sixth-bathroom': { x: 40, y: 700, width: 200, height: 100 },
    'sixth-bar': { x: 280, y: 700, width: 220, height: 100 },
    'sixth-chinese': { x: 540, y: 700, width: 220, height: 100 },
    'sixth-workshop': { x: 800, y: 700, width: 220, height: 100 },
    'sixth-modern-kitchen': { x: 1060, y: 700, width: 320, height: 100 }
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

let currentStudioFloor = '7F';
currentStudioCategory = 'cyclorama';

function renderFloorTabs() {
    return `
        <div class="studio-category-tabs preview-floor-tabs" role="tablist" aria-label="楼层">
            <button type="button" class="studio-category-tab${currentStudioFloor === '6F' ? ' active' : ''}" onclick="switchStudioFloor('6F')" role="tab" aria-selected="${currentStudioFloor === '6F'}">6F</button>
            <button type="button" class="studio-category-tab${currentStudioFloor === '7F' ? ' active' : ''}" onclick="switchStudioFloor('7F')" role="tab" aria-selected="${currentStudioFloor === '7F'}">7F</button>
        </div>
    `;
}

function renderStudioCategoryTabs() {
    return `
        <div class="studio-category-tabs preview-category-tabs" role="tablist" aria-label="影棚类型">
            <button type="button" class="studio-category-tab${currentStudioCategory === 'cyclorama' ? ' active' : ''}" onclick="switchStudioCategory('cyclorama')" role="tab" aria-selected="${currentStudioCategory === 'cyclorama'}">无影棚</button>
            <button type="button" class="studio-category-tab${currentStudioCategory === 'real-scene' ? ' active' : ''}" onclick="switchStudioCategory('real-scene')" role="tab" aria-selected="${currentStudioCategory === 'real-scene'}">实景棚</button>
        </div>
    `;
}

function renderStudioToolbarControls() {
    const toolbarControls = document.getElementById('studioToolbarControls');
    if (!toolbarControls) return;
    toolbarControls.innerHTML = `
        <div class="studio-toolbar-tabs-stack">
            ${renderFloorTabs()}
            ${renderStudioCategoryTabs()}
        </div>
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

function switchStudioFloor(floor) {
    if (!['6F', '7F'].includes(floor) || floor === currentStudioFloor) return;
    currentStudioFloor = floor;
    renderStudioToolbarControls();
    renderStudioSections();
    renderBookings();
}

switchStudioCategory = function switchStudioLayoutCategory(category) {
    if (!['cyclorama', 'real-scene'].includes(category) || category === currentStudioCategory) return;
    currentStudioCategory = category;
    renderStudioToolbarControls();
    renderStudioSections();
    renderBookings();
};

renderStudioSections = function renderStudioLayoutSections() {
    const container = document.getElementById('studioGroups');
    if (!container) return;
    renderStudioToolbarControls();

    const listView = document.getElementById('listView');
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
        <section class="preview-workspace">
            ${renderPreviewStatusLegend()}
            <div id="studioPreviewContent" class="preview-content"></div>
        </section>
    `;
    renderRealSceneOverview();
};

renderBookings = function renderStudioLayoutBookings() {
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
    const reference = STUDIO_SCENE_REFERENCES[studio.id];
    const position = layout?.[studio.mapArea];
    const editable = Boolean(position && canEditSixthFloorLayout());
    return `
        <article
            class="preview-scene-card ${state.type}${state.bookings.length > 0 ? ' has-progress' : ''}${reference ? ' has-scene-reference' : ''}${position ? ' sixth-floor-layout-card' : ''}"
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
            ${reference ? `
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

function fitSixthFloorCanvasToViewport() {
    const viewport = document.querySelector('[data-canvas-viewport]');
    if (!viewport) return;
    const availableWidth = Math.max(viewport.clientWidth - 24, 320);
    const availableHeight = Math.max(viewport.clientHeight - 24, 320);
    const fittedScale = Math.min(1, availableWidth / SIXTH_FLOOR_CANVAS_SIZE.width, availableHeight / SIXTH_FLOOR_CANVAS_SIZE.height);
    sixthFloorViewport = { ...sixthFloorViewport, scale: Number(Math.max(0.55, fittedScale).toFixed(2)) };
    applySixthFloorViewport();
}

function bindSixthFloorCanvas() {
    const viewport = document.querySelector('[data-canvas-viewport]');
    const canvas = document.querySelector('[data-sixth-floor-canvas]');
    if (!viewport || !canvas) return;
    fitSixthFloorCanvasToViewport();
    if (!canEditSixthFloorLayout()) return;
    const layout = loadSixthFloorLayout();
    viewport.addEventListener('wheel', event => {
        event.preventDefault();
        const delta = event.deltaY < 0 ? 0.1 : -0.1;
        sixthFloorViewport.scale = Math.min(1.5, Math.max(0.55, Number((sixthFloorViewport.scale + delta).toFixed(2))));
        applySixthFloorViewport();
    }, { passive: false });
    viewport.querySelectorAll('[data-canvas-action]').forEach(button => button.addEventListener('click', () => {
        const action = button.dataset.canvasAction;
        if (action === 'reset') return resetSixthFloorLayout();
        sixthFloorViewport.scale = Math.min(1.5, Math.max(0.55, Number((sixthFloorViewport.scale + (action === 'zoom-in' ? 0.1 : -0.1)).toFixed(2))));
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
        if (Math.abs(dx) + Math.abs(dy) > 4) state.moved = true;
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
    showAddBookingForm(studioId);
}

function handleRealSceneCardKeydown(event, studioId) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openRealSceneCard(studioId);
}
