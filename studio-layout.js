const baseRenderStudioSections = renderStudioSections;
const baseRenderBookings = renderBookings;
const STUDIO_OVERVIEW_SEGMENTS = 18;
const STUDIO_SCENE_REFERENCES = {
    '洗衣房景别': {
        src: 'assets/real-studio/laundry.webp?v=20260804-laundry-reference',
        alt: '洗衣房景别场景示意图'
    }
};

let currentStudioFloor = '7F';
currentStudioCategory = 'real-scene';

function renderFloorTabs() {
    return `
        <div class="studio-category-tabs preview-floor-tabs" role="tablist" aria-label="楼层">
            <button type="button" class="studio-category-tab${currentStudioFloor === '6F' ? ' active' : ''}" onclick="switchStudioFloor('6F')" role="tab" aria-selected="${currentStudioFloor === '6F'}">6F</button>
            <button type="button" class="studio-category-tab${currentStudioFloor === '7F' ? ' active' : ''}" onclick="switchStudioFloor('7F')" role="tab" aria-selected="${currentStudioFloor === '7F'}">7F</button>
        </div>
    `;
}

function renderStudioCategoryTabs() {
    const realSceneDisabled = currentStudioFloor === '6F';
    return `
        <div class="studio-category-tabs preview-category-tabs" role="tablist" aria-label="影棚类型">
            <button type="button" class="studio-category-tab${currentStudioCategory === 'cyclorama' ? ' active' : ''}" onclick="switchStudioCategory('cyclorama')" role="tab" aria-selected="${currentStudioCategory === 'cyclorama'}">无影棚</button>
            <button type="button" class="studio-category-tab${currentStudioCategory === 'real-scene' ? ' active' : ''}" onclick="switchStudioCategory('real-scene')" role="tab" aria-selected="${currentStudioCategory === 'real-scene'}"${realSceneDisabled ? ' disabled aria-disabled="true" title="6F暂无实景棚"' : ''}>实景棚</button>
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
    if (floor === '6F') currentStudioCategory = 'cyclorama';
    renderStudioSections();
    renderBookings();
}

switchStudioCategory = function switchStudioLayoutCategory(category) {
    if (!['cyclorama', 'real-scene'].includes(category) || category === currentStudioCategory) return;
    if (currentStudioFloor === '6F' && category === 'real-scene') return;
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
    return getAllStudios().filter(studio => studio.category === 'real-scene');
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
    const isEndedToday = date === getChinaDate() && getChinaCurrentTime() >= BOOKING_END_TIME;

    if (isPastDate || isEndedToday) {
        return {
            type: 'ended',
            label: '已结束',
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

    content.className = 'preview-content';
    content.innerHTML = renderRealSceneMap(scenes);
}

function renderRealSceneMap(scenes) {
    return `
        <div class="preview-floor-map" aria-label="7F 实景棚平面总览">
            ${scenes.map(({ studio, state }, index) => renderRealSceneCard(studio, state, index)).join('')}
        </div>
    `;
}

function renderRealSceneCard(studio, state, index) {
    const reference = STUDIO_SCENE_REFERENCES[studio.id];
    return `
        <article
            class="preview-scene-card ${state.type}${state.bookings.length > 0 ? ' has-progress' : ''}${reference ? ' has-scene-reference' : ''}"
            data-map-area="${escapeHtml(studio.mapArea)}"
            data-studio-id="${escapeHtml(studio.id)}"
            style="--preview-index:${index}"
            onclick="openRealSceneCard('${escapeHtml(studio.id)}')"
            onkeydown="handleRealSceneCardKeydown(event, '${escapeHtml(studio.id)}')"
            role="button"
            tabindex="0"
        >
            <div class="preview-scene-card-top">
                <h4>${escapeHtml(studio.title)}</h4>
            </div>
            ${state.bookings.length > 0 && state.type === 'full' ? `
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

function openRealSceneCard(studioId) {
    showAddBookingForm(studioId);
}

function handleRealSceneCardKeydown(event, studioId) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openRealSceneCard(studioId);
}
