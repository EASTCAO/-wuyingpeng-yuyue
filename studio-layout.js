const baseRenderStudioSections = renderStudioSections;
const baseRenderBookings = renderBookings;
const STUDIO_OVERVIEW_SEGMENTS = 18;
const STUDIO_SCENE_REFERENCES = {
    '洗衣房景别': {
        src: 'assets/real-studio/laundry.webp?v=20260804-laundry-reference',
        alt: '洗衣房景别场景示意图'
    }
};

const SIXTH_FLOOR_LAYOUT_VERSION = 2;
const SIXTH_FLOOR_CANVAS_SIZE = { width: 1400, height: 820 };
const SIXTH_FLOOR_DEFAULT_LAYOUT = {
    'sixth-corridor': { x: 16, y: 16, width: 260, height: 82 },
    'sixth-wood-wall': { x: 292, y: 16, width: 260, height: 82 },
    'sixth-greenery-wall': { x: 568, y: 16, width: 260, height: 82 },
    'sixth-ocean-wall': { x: 844, y: 16, width: 260, height: 82 },
    'sixth-street': { x: 1120, y: 16, width: 260, height: 82 },
    'sixth-greenery': { x: 16, y: 120, width: 150, height: 470 },
    'sixth-kids': { x: 184, y: 120, width: 150, height: 115 },
    'sixth-classroom': { x: 350, y: 120, width: 205, height: 115 },
    'sixth-clinic': { x: 184, y: 250, width: 371, height: 115 },
    'sixth-study': { x: 570, y: 120, width: 190, height: 245 },
    'sixth-vintage-living': { x: 775, y: 120, width: 190, height: 245 },
    'sixth-vintage-dining': { x: 980, y: 120, width: 205, height: 245 },
    'sixth-modern-living': { x: 184, y: 430, width: 205, height: 145 },
    'sixth-modern-dining': { x: 410, y: 430, width: 205, height: 145 },
    'sixth-outdoor-cafe': { x: 636, y: 430, width: 205, height: 145 },
    'sixth-bedroom': { x: 862, y: 430, width: 323, height: 145 },
    'sixth-bathroom': { x: 16, y: 610, width: 150, height: 90 },
    'sixth-bar': { x: 184, y: 610, width: 150, height: 90 },
    'sixth-chinese': { x: 350, y: 610, width: 150, height: 90 },
    'sixth-workshop': { x: 516, y: 610, width: 150, height: 90 },
    'sixth-modern-kitchen': { x: 682, y: 610, width: 205, height: 90 }
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

function loadSixthFloorLayout() {
    if (!canEditSixthFloorLayout()) return structuredClone(SIXTH_FLOOR_DEFAULT_LAYOUT);
    try {
        const stored = JSON.parse(localStorage.getItem(getSixthFloorLayoutStorageKey()) || 'null');
        return stored?.version === SIXTH_FLOOR_LAYOUT_VERSION && stored.layout
            ? { ...structuredClone(SIXTH_FLOOR_DEFAULT_LAYOUT), ...stored.layout }
            : structuredClone(SIXTH_FLOOR_DEFAULT_LAYOUT);
    } catch {
        return structuredClone(SIXTH_FLOOR_DEFAULT_LAYOUT);
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

function renderStudioToolbar(includeLegend = false) {
    const statusLegend = includeLegend ? `
        <div class="preview-status-legend" aria-label="预约状态颜色说明">
            <span class="preview-legend-item"><i class="preview-legend-swatch available"></i>可预约</span>
            <span class="preview-legend-item"><i class="preview-legend-swatch partial"></i>部分预约</span>
            <span class="preview-legend-item"><i class="preview-legend-swatch full"></i>已约满</span>
        </div>
    ` : '';

    return `
        <div class="preview-lobby-toolbar">
            ${renderFloorTabs()}
            ${statusLegend}
        </div>
    `;
}

function switchStudioFloor(floor) {
    if (!['6F', '7F'].includes(floor) || floor === currentStudioFloor) return;
    currentStudioFloor = floor;
    renderStudioSections();
    renderBookings();
}

switchStudioCategory = function switchStudioLayoutCategory(category) {
    if (!['cyclorama', 'real-scene'].includes(category) || category === currentStudioCategory) return;
    currentStudioCategory = category;
    renderStudioSections();
    renderBookings();
};

renderStudioSections = function renderStudioLayoutSections() {
    const container = document.getElementById('studioGroups');
    if (!container) return;

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
        container.insertAdjacentHTML('afterbegin', `
            ${renderStudioToolbar()}
            <div class="preview-workspace-header preview-category-header">
                ${renderStudioCategoryTabs()}
            </div>
        `);
        return;
    }

    document.getElementById('listView')?.classList.add('real-scene-active', 'studio-layout-active');

    container.innerHTML = `
        ${renderStudioToolbar(true)}
        <section class="preview-workspace">
            <header class="preview-workspace-header preview-category-header">
                ${renderStudioCategoryTabs()}
            </header>
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
            next.x = Math.round((state.originX + dx / sixthFloorViewport.scale) / 12) * 12;
            next.y = Math.round((state.originY + dy / sixthFloorViewport.scale) / 12) * 12;
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
            }
        }
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
