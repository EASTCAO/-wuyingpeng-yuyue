// 调试日志：只在本地预览或手动开启 localStorage.debug='1' 时输出。
// 线上默认静音，避免 30 秒一次的轮询日志刷屏。错误一律走 console.error，不受影响。
const DEBUG_LOGGING = (() => {
    try {
        if (localStorage.getItem('debug') === '1') return true;
    } catch {
        // 隐私模式下 localStorage 可能不可用，忽略即可。
    }
    return ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
})();

function debugLog(...args) {
    if (DEBUG_LOGGING) console.log(...args);
}

// 全局变量
let currentUser = null;
let allBookings = [];
let selectedBookingId = null;
let currentView = 'list'; // 'list' or 'stats'
let currentDateRange = 'today'; // 'today', 'tomorrow', 'week'
let selectedDate = null;
const BOOKING_DATE_PAGE_SIZE = 7;
let bookingDateStripStart = null;
let bookingDateStripContext = '';

let pendingCancelBookingId = null;
let pendingCancelStudioId = null;
let reminderInterval = null;
let notifiedBookings = new Set(); // 记录已通知的预约ID
let soundEnabled = true;
let globalAudioContext = null; // 全局 AudioContext
let authToken = null;
let editingBookingId = null;
let bookingSaveInFlight = false;
let bookingDeleteInFlight = false;
let currentStudioCategory = 'cyclorama';
let bookingsLoaded = false;
let bookingHistoryLoaded = false;
let simpleVideoBookingContext = null;
const SIMPLE_VIDEO_ASSIGNMENTS = {
    '曹东': '涂萱',
    '於佳莹': '向芷琪',
    '夏驰': '李冬梅',
    '谭金林': '何雨涵',
    '杨丽': '魏钰涵',
    '卢圣林': '王羽',
    '鄢军': '曹玉',
    '吕文祎': '王思琪',
    '徐优': '程思盈',
    '周旭欣': '魏钰涵',
    '付国俊': '阮静',
    '沈磊': '王斐雯',
    '张阳洋': '魏钰涵'
};
let simpleVideoTasks = [];
const modalFocusStack = [];

function getModalFocusableElements(modal) {
    return Array.from(modal.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )).filter(element => !element.closest('[hidden]') && element.offsetParent !== null);
}

function openAccessibleModal(modalId, initialFocusSelector) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const existingEntry = modalFocusStack.find(entry => entry.modal === modal);
    if (!existingEntry) {
        modalFocusStack.push({ modal, trigger: document.activeElement });
    }

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => {
        const initialFocus = initialFocusSelector ? modal.querySelector(initialFocusSelector) : null;
        (initialFocus || getModalFocusableElements(modal)[0])?.focus({ preventScroll: true });
    });
}

function closeAccessibleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add('hidden');
    let entryIndex = -1;
    for (let index = modalFocusStack.length - 1; index >= 0; index -= 1) {
        if (modalFocusStack[index].modal === modal) {
            entryIndex = index;
            break;
        }
    }
    const [entry] = entryIndex >= 0 ? modalFocusStack.splice(entryIndex, 1) : [];
    const activeModal = modalFocusStack[modalFocusStack.length - 1]?.modal;
    document.body.classList.toggle('modal-open', Boolean(activeModal));

    requestAnimationFrame(() => {
        if (entry?.trigger?.isConnected) {
            entry.trigger.focus({ preventScroll: true });
        } else if (activeModal) {
            getModalFocusableElements(activeModal)[0]?.focus({ preventScroll: true });
        }
    });
}

document.addEventListener('keydown', event => {
    const modal = modalFocusStack[modalFocusStack.length - 1]?.modal;
    if (!modal || modal.classList.contains('hidden')) return;

    if (event.key === 'Escape') {
        const closeControl = modal.querySelector('[data-modal-close]');
        if (closeControl) {
            event.preventDefault();
            closeControl.click();
        }
        return;
    }

    if (event.key !== 'Tab') return;
    const focusableElements = getModalFocusableElements(modal);
    if (focusableElements.length === 0) {
        event.preventDefault();
        return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
    }
});

// ============ 影棚配置 ============
// 所有影棚入口、下拉框、统计筛选和时间轴都从这里生成。
const STUDIO_GROUPS = [
    {
        key: 'large',
        title: '大棚区域',
        subtitle: '主力拍摄区',
        optionLabel: '大棚',
        cardClass: 'studio-section-large',
        buttonClass: 'btn-primary',
        studios: [
            { id: '大无影棚1（工位对面）', title: '无影棚1', location: '工位对面' },
            { id: '大无影棚2（鄢军隔壁）', title: '无影棚2', location: '鄢军隔壁' }
        ]
    },
    {
        key: 'small',
        title: '小棚区域',
        subtitle: '常用小棚区',
        optionLabel: '小棚',
        cardClass: 'studio-section-small',
        buttonClass: 'btn-success',
        studios: [
            { id: '小无影棚1', title: '无影棚1', location: '小棚区 1', frozen: true },
            { id: '小无影棚2', title: '无影棚2', location: '小棚区 2', frozen: true },
            { id: '小无影棚3', title: '无影棚3', location: '大无影棚对面' },
            { id: '小无影棚4', title: '无影棚4', location: '谭金林隔壁' }
        ]
    },
    {
        key: 'sixth-floor',
        category: 'cyclorama',
        title: '6F',
        subtitle: '跨楼层备用棚',
        optionLabel: '6F',
        cardClass: 'studio-section-sixth',
        buttonClass: 'btn-primary',
        studios: [
            { id: '6F无影棚', title: '6F无影棚', location: '6F' }
        ]
    },
    {
        key: 'real-scene',
        category: 'real-scene',
        title: '7F 实景棚',
        subtitle: '7F 实景棚',
        optionLabel: '7F 实景棚',
        cardClass: 'studio-section-real',
        buttonClass: 'btn-primary',
        studios: [
            { id: '小木屋景', title: '小木屋景', location: '7F 实景棚', mapArea: 'main-cabin' },
            { id: '卧室景', title: '卧室景', location: '7F 实景棚', mapArea: 'main-bedroom' },
            { id: '酒吧景', title: '酒吧景', location: '7F 实景棚', mapArea: 'main-bar' },
            { id: '书房景', title: '书房景', location: '7F 实景棚', mapArea: 'main-study' },
            { id: '客厅景', title: '客厅景', location: '7F 实景棚', mapArea: 'main-living' },
            { id: '工具台景', title: '工具台景', location: '7F 实景棚', mapArea: 'main-workbench' },
            { id: '木纹台面-厨房景', title: '木纹台面-厨房景', location: '7F 实景棚', mapArea: 'main-wood-kitchen' },
            { id: '儿童房景/户外下午茶景', title: '儿童房景/户外下午茶景', location: '7F 实景棚', mapArea: 'main-kids-tea' },
            { id: '洗衣房景别', title: '洗衣房景别', location: '7F 实景棚', mapArea: 'service-laundry' },
            { id: '浴室景', title: '浴室景', location: '7F 实景棚', mapArea: 'service-bathroom' },
            { id: '黑色台面-厨房景', title: '黑色台面-厨房景', location: '7F 实景棚', mapArea: 'service-black-kitchen' }
        ]
    },
    {
        key: 'real-scene-sixth-floor',
        category: 'real-scene',
        floor: '6F',
        title: '6F 实景棚',
        subtitle: '6F 实景棚',
        optionLabel: '6F 实景棚',
        cardClass: 'studio-section-real',
        buttonClass: 'btn-primary',
        studios: [
            { id: '6F·走廊景', title: '走廊景', location: '6F 实景棚', mapArea: 'sixth-corridor' },
            { id: '6F·木墙景', title: '木墙景', location: '6F 实景棚', mapArea: 'sixth-wood-wall' },
            { id: '6F·绿植背景墙景', title: '绿植背景墙', location: '6F 实景棚', mapArea: 'sixth-greenery-wall' },
            { id: '6F·绿植房景', title: '花房背景', location: '6F 实景棚', mapArea: 'sixth-greenery' },
            { id: '6F·儿童房景', title: '婴幼儿童区', location: '6F 实景棚', mapArea: 'sixth-kids' },
            { id: '6F·教室景', title: '教室景', location: '6F 实景棚', mapArea: 'sixth-classroom' },
            { id: '6F·医护室景', title: '医护室景', location: '6F 实景棚', mapArea: 'sixth-clinic' },
            { id: '6F·海洋背景墙景', title: '海洋区', location: '6F 实景棚', mapArea: 'sixth-ocean-wall' },
            { id: '6F·书房景', title: '书房景', location: '6F 实景棚', mapArea: 'sixth-study' },
            { id: '6F·复古餐厅景', title: '复古客餐厅', location: '6F 实景棚', mapArea: 'sixth-vintage-dining' },
            { id: '6F·现代客厅景', title: '现代客厅景', location: '6F 实景棚', mapArea: 'sixth-modern-living' },
            { id: '6F·现代餐厅景', title: '现代餐厅景', location: '6F 实景棚', mapArea: 'sixth-modern-dining' },
            { id: '6F·街道景', title: '街道景', location: '6F 实景棚', mapArea: 'sixth-street' },
            { id: '6F·户外咖啡景', title: '咖啡窗台', location: '6F 实景棚', mapArea: 'sixth-outdoor-cafe' },
            { id: '6F·卧室景', title: '卧室', location: '6F 实景棚', mapArea: 'sixth-bedroom' },
            { id: '6F·洗浴室景', title: '卫浴', location: '6F 实景棚', mapArea: 'sixth-bathroom' },
            { id: '6F·吧台景', title: '吧台景', location: '6F 实景棚', mapArea: 'sixth-bar' },
            { id: '6F·国风景', title: '国风景', location: '6F 实景棚', mapArea: 'sixth-chinese' },
            { id: '6F·工具间景', title: '工具墙', location: '6F 实景棚', mapArea: 'sixth-workshop' },
            { id: '6F·现代厨房景', title: '厨房', location: '6F 实景棚', mapArea: 'sixth-modern-kitchen' },
            { id: '6F·茶水间', title: '茶水间', location: '6F 实景棚', mapArea: 'sixth-tea-room' },
            { id: '5F·阳台景', title: '5楼阳台', location: '5F 阳台', mapArea: 'fifth-balcony' }
        ]
    }
];

function getAllStudios() {
    return STUDIO_GROUPS.flatMap(group => group.studios.map(studio => ({
        ...studio,
        category: group.category || 'cyclorama',
        groupKey: group.key,
        groupTitle: group.title,
        groupOptionLabel: group.optionLabel,
        groupSubtitle: group.subtitle,
        cardClass: group.cardClass,
        buttonClass: group.buttonClass
    })));
}

function getDefaultStudioId() {
    return getAllStudios()[0].id;
}

function getStudioById(studioId) {
    return getAllStudios().find(studio => studio.id === studioId);
}

function isStudioFrozen(studioId) {
    return Boolean(getStudioById(studioId)?.frozen);
}

function getStudioListId(studioId) {
    const index = getAllStudios().findIndex(studio => studio.id === studioId);
    return index >= 0 ? `studio${index + 1}List` : '';
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function inlineJsString(value) {
    return escapeHtml(JSON.stringify(String(value)));
}

function renderStudioSections() {
    const container = document.getElementById('studioGroups');
    if (!container) return;
    document.getElementById('listView')?.classList.toggle('real-scene-active', currentStudioCategory === 'real-scene');

    const renderGroup = (group, animationOffset = 0) => {
        const isRealScene = group.category === 'real-scene';
        return `
        <section class="studio-floor-zone studio-map-zone studio-map-zone-${group.key}">
            <div class="studio-map-zone-header">
                <h3>${escapeHtml(group.title)}</h3>
            </div>
            <div class="studio-map-cards${isRealScene ? ` real-floor-map real-floor-map-${group.key.replace('real-', '')}` : ''}">
                ${group.studios.map((studio, index) => `
                    <div
                        class="studio-section studio-overview-card ${group.cardClass}${studio.frozen ? ' studio-frozen' : ''}${isRealScene ? ' real-scene-card' : ''}"
                        data-studio-id="${escapeHtml(studio.id)}"
                        data-studio-group="${group.key}"
                        ${isRealScene ? `data-map-area="${escapeHtml(studio.mapArea)}"` : ''}
                        ${isRealScene ? `style="--scene-index: ${animationOffset + index}"` : ''}
                        ${studio.frozen ? 'aria-disabled="true"' : `onclick="showAddBookingForm('${escapeHtml(studio.id)}')"`}
                        role="${studio.frozen ? 'group' : 'button'}"
                        tabindex="${studio.frozen ? '-1' : '0'}"
                        ${studio.frozen ? '' : `onkeydown="handleStudioCardKeydown(event, '${escapeHtml(studio.id)}')"`}
                    >
                        ${isRealScene ? `
                            <div class="real-scene-room">
                                <span class="real-scene-status-label">可预约</span>
                                <div class="real-scene-title">
                                    <h2>${escapeHtml(studio.title)}</h2>
                                </div>
                                <div class="real-scene-occupancy" aria-label="已预约时段占比 0%">
                                    <span class="real-scene-occupancy-track"><i></i></span>
                                    <small>0%</small>
                                </div>
                            </div>
                        ` : `<div class="studio-section-header">
                            <div>
                                <h2>
                                    ${escapeHtml(studio.title)}
                                    ${(group.key === 'large' || (group.key === 'small' && !studio.frozen)) && studio.location ? `<small class="studio-card-location">· ${escapeHtml(studio.location)}</small>` : ''}
                                </h2>
                            </div>
                            ${studio.frozen ? '<span class="studio-frozen-label">已冻结</span>' : ''}
                        </div>`}
                        <div id="${getStudioListId(studio.id)}" class="studio-summary${isRealScene ? ' real-scene-summary' : ''}">
                            ${isRealScene ? '' : `<p class="studio-booking-loading">${bookingsLoaded ? '暂无预约' : '预约加载中'}</p>`}
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
    };

    const categoryTabs = `
        <div class="studio-category-tabs" role="tablist" aria-label="影棚类型">
            <button type="button" class="studio-category-tab${currentStudioCategory === 'cyclorama' ? ' active' : ''}" onclick="switchStudioCategory('cyclorama')" role="tab" aria-selected="${currentStudioCategory === 'cyclorama'}">无影棚</button>
            <button type="button" class="studio-category-tab${currentStudioCategory === 'real-scene' ? ' active' : ''}" onclick="switchStudioCategory('real-scene')" role="tab" aria-selected="${currentStudioCategory === 'real-scene'}">实景棚</button>
        </div>
    `;

    if (currentStudioCategory === 'real-scene') {
        const realSceneGroup = STUDIO_GROUPS.find(group => group.key === 'real-scene');
        container.innerHTML = `
            ${categoryTabs}
            <section class="real-studio-floor">
                <div class="real-studio-floor-header">
                    <h3>7F 实景棚</h3>
                    <div class="real-studio-legend" aria-label="预约状态">
                        <span><i class="real-studio-legend-swatch available" aria-hidden="true"></i>可预约</span>
                        <span><i class="real-studio-legend-swatch partial" aria-hidden="true"></i>部分预约</span>
                        <span><i class="real-studio-legend-swatch full" aria-hidden="true"></i>已约满</span>
                    </div>
                </div>
                <div class="real-studio-layout">
                    ${realSceneGroup ? renderGroup(realSceneGroup) : ''}
                </div>
            </section>
        `;
        return;
    }

    const seventhFloorGroups = STUDIO_GROUPS.filter(group => group.key === 'large' || group.key === 'small');
    const sixthFloorGroup = STUDIO_GROUPS.find(group => group.key === 'sixth-floor');

    container.innerHTML = `
        ${categoryTabs}
        <div class="studio-map">
            <section class="studio-map-zone studio-map-zone-seventh-floor">
                <div class="studio-map-zone-header studio-floor-header">
                    <h3>7F</h3>
                </div>
                <div class="studio-floor-zones">
                    ${seventhFloorGroups.map(renderGroup).join('')}
                </div>
            </section>
            ${sixthFloorGroup ? `
                <section class="studio-map-zone studio-map-zone-${sixthFloorGroup.key}">
                    <div class="studio-map-zone-header">
                        <h3>${escapeHtml(sixthFloorGroup.title)}</h3>
                    </div>
                    <div class="studio-map-cards">
                        ${sixthFloorGroup.studios.map(studio => `
                            <div
                                class="studio-section studio-overview-card ${sixthFloorGroup.cardClass}"
                                data-studio-id="${escapeHtml(studio.id)}"
                                data-studio-group="${sixthFloorGroup.key}"
                                onclick="showAddBookingForm('${escapeHtml(studio.id)}')"
                                role="button"
                                tabindex="0"
                                onkeydown="handleStudioCardKeydown(event, '${escapeHtml(studio.id)}')"
                            >
                                <div class="studio-section-header">
                                    <div><h2>${escapeHtml(studio.title.replace(/^6F/, ''))}</h2></div>
                                </div>
                                <div id="${getStudioListId(studio.id)}" class="studio-summary">
                                    <p class="studio-booking-loading">${bookingsLoaded ? '暂无预约' : '预约加载中'}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            ` : ''}
        </div>
    `;
}

function switchStudioCategory(category) {
    if (!['cyclorama', 'real-scene'].includes(category) || category === currentStudioCategory) return;
    currentStudioCategory = category;
    renderStudioSections();
    renderBookings();
}

function renderStudioOptions(selectId, includeAll = false) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const allOption = includeAll ? '<option value="all">所有影棚</option>' : '';
    select.innerHTML = allOption + STUDIO_GROUPS.map(group => `
        <optgroup label="${group.optionLabel}">
            ${group.studios.map(studio => `<option value="${escapeHtml(studio.id)}"${studio.frozen && !includeAll ? ' disabled' : ''}>${studio.id}${studio.frozen && !includeAll ? '（已冻结）' : ''}</option>`).join('')}
        </optgroup>
    `).join('');
}

function initStudioUI() {
    renderStudioSections();
    renderStudioOptions('studioSelect');
    renderStudioOptions('statsStudio', true);
}

function handleStudioCardKeydown(event, studioId) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showAddBookingForm(studioId);
    }
}

function normalizeStudioName(studioName) {
    const studioNameMap = {
        '无影棚1号': '大无影棚1（工位对面）',
        '无影棚2号': '大无影棚2（鄢军隔壁）',
        '无影棚3号': '小无影棚1',
        '无影棚4号': '小无影棚2',
        '5楼无影棚': '小无影棚2',
        '6楼无影棚': '6F无影棚'
    };

    return studioNameMap[studioName] || studioName;
}

// ============ API 配置 ============
// 部署后端后，将此 URL 改为你的后端地址
// 例如：'https://your-backend.zeabur.app'
// 设置为空字符串则使用本地 localStorage（单机模式，无法多用户同步）
const ONLINE_API_BASE_URL = 'https://wuhanphotoyy.zeabur.app'; // 线上后端 API
const LOCAL_PREVIEW_HOSTS = ['localhost', '127.0.0.1', ''];
const IS_LOCAL_PREVIEW = typeof window !== 'undefined'
    && window.location
    && LOCAL_PREVIEW_HOSTS.includes(window.location.hostname);
const API_BASE_URL = IS_LOCAL_PREVIEW ? '' : ONLINE_API_BASE_URL;

// 营业时段、时间换算、时段合法性、冲突判断和预约状态统一由 shared/booking-rules.js 提供，
// 它在 index.html 里先于 app.js 加载，并把下列名字挂到 globalThis：
//   BOOKING_START_TIME / BOOKING_END_TIME / BOOKING_INTERVAL_MINUTES / BOOKABLE_PERIODS
//   getChinaDate / getChinaCurrentTime / timeToMinutes / minutesToTime / getDateOnly
//   getBookablePeriod / getTimeOptions / getBookingStartTimes / isValidBookingRange
//   hasTimeOverlap / isValidBookingDate / isBookingStartAvailable / isBookingEditable
//   getBookingStatus / getBookedSlotPercentage
// 后端 api/server.js 使用同一份代码（api/booking-rules.js 是自动同步副本）。

function createBookingId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function renderTimeSelectOptions() {
    const startTimeSelect = document.getElementById('startTime');
    const endTimeSelect = document.getElementById('endTime');
    if (!startTimeSelect || !endTimeSelect) return;

    const startTimes = BOOKABLE_PERIODS.flatMap(period => getTimeOptions(period.start, period.end).slice(0, -1));
    const endTimes = BOOKABLE_PERIODS.flatMap(period => getTimeOptions(period.start, period.end).slice(1));
    startTimeSelect.innerHTML = '<option value="">请选择开始时间</option>'
        + startTimes.map(time => `<option value="${time}">${time}</option>`).join('');
    endTimeSelect.innerHTML = '<option value="">请选择结束时间</option>'
        + endTimes.map(time => `<option value="${time}">${time}</option>`).join('');
}

// 检查是否使用云端同步
function isCloudMode() {
    return API_BASE_URL && API_BASE_URL.length > 0;
}

async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    if (response.status === 401 && isCloudMode()) {
        authToken = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        currentUser = null;
        stopAutoRefresh();
        stopStateRefresh();
        document.getElementById('loginPage')?.classList.remove('hidden');
        document.getElementById('mainPage')?.classList.add('hidden');
    }
    return response;
}

// 自动刷新间隔（云端模式下每30秒刷新一次）
let autoRefreshInterval = null;
let bookingAvailabilityRefreshInterval = null;

// 页面在后台时不轮询：省电、省流量，也避免看不见的整页重渲染。
function isPageVisible() {
    return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

function startAutoRefresh() {
    if (isCloudMode() && !autoRefreshInterval) {
        autoRefreshInterval = setInterval(async () => {
            if (!isPageVisible()) return;
            if (bookingSaveInFlight || bookingDeleteInFlight) return;
            debugLog('🔄 自动刷新数据...');
            await loadBookings();
        }, 30000); // 30秒刷新一次
    }
}

// 切回前台立刻补一次，不用等下一个轮询周期。
document.addEventListener('visibilitychange', () => {
    if (!isPageVisible() || !autoRefreshInterval) return;
    if (bookingSaveInFlight || bookingDeleteInFlight) return;
    loadBookings();
});

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// 预约状态（未开始 / 进行中 / 已结束 / 已过期）是随时间自己翻转的，
// 但重渲染原来只挂在 loadBookings 上——那是数据驱动的。后果：
//   - 本地模式没有任何轮询，页面开着过了 18:15 也不会变成"已过期"
//   - 云端模式下请求失败、或标签页在后台跳过轮询时，状态同样停在旧值
// 所以状态刷新必须独立于网络。renderAllViews 内部有签名比对，
// 时间桶（15 分钟）没跨过去时会整轮跳过，代价极低。
let stateRefreshInterval = null;

function startStateRefresh() {
    if (stateRefreshInterval) return;
    stateRefreshInterval = setInterval(() => {
        if (!isPageVisible()) return;
        if (bookingSaveInFlight || bookingDeleteInFlight) return;
        renderAllViews();
    }, 30000);
}

function stopStateRefresh() {
    if (stateRefreshInterval) {
        clearInterval(stateRefreshInterval);
        stateRefreshInterval = null;
    }
}

function startBookingAvailabilityRefresh() {
    if (bookingAvailabilityRefreshInterval) clearInterval(bookingAvailabilityRefreshInterval);
    bookingAvailabilityRefreshInterval = setInterval(async () => {
        if (!isPageVisible()) return;
        const modal = document.getElementById('addBookingModal');
        if (!modal || modal.classList.contains('hidden')) return;
        if (bookingSaveInFlight || bookingDeleteInFlight) return;
        if (isCloudMode()) await loadBookings();
        const studioSelect = document.getElementById('studioSelect');
        const dateInput = document.getElementById('bookingDate');
        if (!studioSelect || !dateInput) return;
        const startTimeSelect = document.getElementById('startTime');
        const endTimeSelect = document.getElementById('endTime');
        const existingBookings = allBookings.filter(booking =>
            booking.id !== editingBookingId
            && booking.studio === studioSelect.value
            && getDateOnly(booking.date) === dateInput.value
        );
        const today = getChinaDate();
        const currentTime = getChinaCurrentTime();
        startTimeSelect?.querySelectorAll('option').forEach(option => {
            if (!option.value) return;
            option.disabled = (dateInput.value === today && option.value <= currentTime)
                || existingBookings.some(booking => option.value >= booking.startTime && option.value < booking.endTime);
        });
        if (startTimeSelect?.value && startTimeSelect.selectedOptions[0]?.disabled) {
            startTimeSelect.value = '';
            if (endTimeSelect) endTimeSelect.value = '';
        }
        if (startTimeSelect?.value && endTimeSelect) {
            updateEndTimeOptions(startTimeSelect.value, endTimeSelect, existingBookings);
        }
        renderAvailabilityPanel();
    }, 15000);
}

function stopBookingAvailabilityRefresh() {
    if (bookingAvailabilityRefreshInterval) {
        clearInterval(bookingAvailabilityRefreshInterval);
        bookingAvailabilityRefreshInterval = null;
    }
}

// ============ 右上角用户菜单 ============
// 统计 / 简易视频待办 / 用户管理 / 修改密码 / 退出登录都收在这里。
// 原来它们在一条 160px 的固定侧栏里，摄影师日常几乎不用，白占了主内容区的宽度。
// "只看我的" 和 "提醒" 两个开关没有收进来——状态需要一眼可见，留在工具栏上。

function isUserMenuOpen() {
    const menu = document.getElementById('userMenu');
    return Boolean(menu) && !menu.classList.contains('hidden');
}

function openUserMenu() {
    const menu = document.getElementById('userMenu');
    const button = document.getElementById('userMenuButton');
    if (!menu || !button) return;
    menu.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
    menu.querySelector('.user-menu-item:not(.hidden):not([style*="display:none"])')?.focus({ preventScroll: true });
}

function closeUserMenu({ restoreFocus = false } = {}) {
    const menu = document.getElementById('userMenu');
    const button = document.getElementById('userMenuButton');
    if (!menu || !button) return;
    menu.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus({ preventScroll: true });
}

function toggleUserMenu() {
    if (isUserMenuOpen()) closeUserMenu({ restoreFocus: true });
    else openUserMenu();
}

// 菜单项统一走这里：先关菜单再执行，避免弹窗打开后菜单还浮在上面。
function runFromUserMenu(action) {
    closeUserMenu();
    action();
}

document.addEventListener('click', event => {
    if (!isUserMenuOpen()) return;
    if (event.target.closest('.user-menu')) return;
    closeUserMenu();
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isUserMenuOpen()) closeUserMenu({ restoreFocus: true });
});

// 初始化应用
window.addEventListener('DOMContentLoaded', async () => {
    debugLog('✅ 应用初始化成功（使用 localStorage）');

    updateOnlineStatus();

    // 监听任意点击以解锁音频（iOS必须）
    document.addEventListener('click', unlockAudio, { once: false });
    document.addEventListener('touchstart', unlockAudio, { once: false });

    // 云端模式必须通过服务端会话恢复登录，本地预览保留原来的本地模式。
    authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (isCloudMode()) {
        // 线上登录只保存会话令牌和用户名，清理旧版本可能遗留的明文密码。
        localStorage.removeItem('savedPassword');
        document.getElementById('guestLoginButton')?.classList.add('hidden');
    }
    if (!isCloudMode() && savedUser) {
        currentUser = savedUser;
        showMainPage();
    } else if (!isCloudMode()) {
        const rememberMe = localStorage.getItem('rememberMe');
        const savedUsername = localStorage.getItem('savedUsername');
        const savedPassword = localStorage.getItem('savedPassword');

        if (rememberMe === 'true' && savedUsername && savedPassword) {
            document.getElementById('photographerName').value = savedUsername;
            document.getElementById('loginPassword').value = savedPassword;
            document.getElementById('rememberMe').checked = true;
            login();
        }
    } else if (authToken) {
        try {
            const response = await apiFetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                currentUser = data.user.username;
                if (localStorage.getItem('authToken')) {
                    localStorage.setItem('currentUser', currentUser);
                } else {
                    sessionStorage.setItem('currentUser', currentUser);
                }
                showMainPage();
            } else {
                authToken = null;
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('currentUser');
            }
        } catch (error) {
            console.error('恢复登录失败:', error);
        }
    }

    // 设置今天的日期为默认值
    const today = getChinaDate();
    document.getElementById('bookingDate').value = today;
});

// ============ 用户账户配置 ============
// 初始用户列表（首次使用时写入 localStorage，之后通过前端管理）
const DEFAULT_USERS = {
    '周旭欣': '123456',
    '曹东': '123456',
    '曹玉': '123456',
    '程维跃': '123456',
    '付国俊': '123456',
    '何雨涵': '123456',
    '李冬梅': '123456',
    '卢圣林': '123456',
    '吕书悦': '123456',
    '阮静': '123456',
    '沈磊': '123456',
    '涂萱': '123456',
    '王斐雯': '123456',
    '王思琪': '123456',
    '王羽': '123456',
    '魏钰涵': '123456',
    '於佳莹': '123456',
    '夏驰': '123456',
    '向芷琪': '123456',
    '杨丽': '123456',
    '鄢军': '123456',
    '张阳洋': '123456',
    '刘欣悦': '123456',
    '吕文祎': '123456',
    '叶雨婷': '123456',
    '程思盈': '123456',
    '魏伟': '123456',
    '谭金林': '123456',
    '徐优': '123456',
    '陈梦轲': '123456',
    '陈思': '123456',
    '樊瑾怡': '123456',
    '李梦涵': '123456',
    '向纯希': '123456',
    '夏姝敏': '123456',
    '周梓君': '123456',
    'admin': '123456'
};

// 已重命名/移除的用户，loadUsers 时从本地存储清理
const REMOVED_USERS = ['徐天奇'];

// 从 localStorage 加载用户列表，首次使用时用默认列表初始化
function loadUsers() {
    const stored = localStorage.getItem('userList');
    if (stored) {
        const users = JSON.parse(stored);
        // 自动合并 DEFAULT_USERS 中新增的用户（不覆盖已有用户的密码）
        let updated = false;
        for (const name in DEFAULT_USERS) {
            if (!(name in users)) {
                users[name] = DEFAULT_USERS[name];
                updated = true;
            }
        }
        // 清理已重命名/移除的遗留用户
        for (const name of REMOVED_USERS) {
            if (name in users) {
                delete users[name];
                updated = true;
            }
        }
        if (updated) {
            localStorage.setItem('userList', JSON.stringify(users));
        }
        return users;
    }
    // 首次使用，写入默认用户
    localStorage.setItem('userList', JSON.stringify(DEFAULT_USERS));
    return { ...DEFAULT_USERS };
}

function saveUsers(users) {
    localStorage.setItem('userList', JSON.stringify(users));
}

// 动态用户列表
let USERS = loadUsers();

// ============ 用户管理（仅 admin） ============
async function addNewUser(name) {
    name = name.trim();
    if (!name) return false;
    if (isCloudMode()) {
        const response = await apiFetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: name })
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            showToast(data.error || '添加用户失败', 'error');
            return false;
        }
        // 后端没有固定初始密码时会随机生成一个，必须显示出来交给本人。
        const created = await response.json().catch(() => ({}));
        if (created.initialPassword) {
            showToast(`用户 ${name} 的初始密码：${created.initialPassword}（请转告本人并尽快修改）`, 'success');
        }
        return true;
    }
    if (USERS[name]) {
        showToast(`用户 "${name}" 已存在`, 'error');
        return false;
    }
    USERS[name] = '123456';
    saveUsers(USERS);
    return true;
}

async function removeUser(name) {
    if (name === 'admin') {
        showToast('不能删除管理员账户', 'error');
        return false;
    }
    if (!isCloudMode() && !USERS[name]) {
        showToast(`用户 "${name}" 不存在`, 'error');
        return false;
    }
    if (isCloudMode()) {
        const response = await apiFetch(`/api/users/${encodeURIComponent(name)}`, { method: 'DELETE' });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            showToast(data.error || '删除用户失败', 'error');
            return false;
        }
        return true;
    }
    delete USERS[name];
    saveUsers(USERS);
    return true;
}

async function renderUserManagement() {
    const container = document.getElementById('userManagementContent');
    if (!container) return;

    let userNames;
    if (isCloudMode()) {
        try {
            const response = await apiFetch('/api/users');
            const users = response.ok ? await response.json() : [];
            userNames = users.filter(user => user.username !== 'admin').map(user => user.username).sort();
        } catch {
            userNames = [];
        }
    } else {
        userNames = Object.keys(USERS).filter(n => n !== 'admin').sort();
    }

    container.innerHTML = `
        <div class="user-mgmt-add">
            <input type="text" id="newUserInput" placeholder="输入用户名（多个用逗号分隔）" maxlength="100">
            <button onclick="handleAddUsers()" class="btn btn-primary btn-small">添加</button>
        </div>
        <div class="simple-video-assignment-setting">
            <div class="simple-video-assignment-title">简易视频人员绑定</div>
            <div class="simple-video-assignment-list">
                ${Object.entries(SIMPLE_VIDEO_ASSIGNMENTS).map(([photographer, recipient]) => `
                    <div class="simple-video-assignment-item">
                        <span>${escapeHtml(photographer)}</span><span aria-hidden="true">→</span><span>${escapeHtml(recipient)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="user-mgmt-count">共 ${userNames.length} 个用户</div>
        <div class="user-mgmt-list">
            ${userNames.map(name => `
                <div class="user-mgmt-item">
                    <span class="user-mgmt-name">${escapeHtml(name)}</span>
                    <button onclick="handleRemoveUser(${inlineJsString(name)})" class="btn btn-danger btn-small">删除</button>
                </div>
            `).join('')}
        </div>
    `;

    // 回车添加
    setTimeout(() => {
        const input = document.getElementById('newUserInput');
        if (input) {
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') handleAddUsers();
            });
        }
    }, 0);
}

async function handleAddUsers() {
    const input = document.getElementById('newUserInput');
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) return;

    // 支持逗号、顿号、空格分隔
    const names = raw.split(/[,，、\s]+/).filter(n => n.trim());
    let added = 0;
    for (const name of names) {
        if (await addNewUser(name)) added++;
    }
    if (added > 0) {
        showToast(`成功添加 ${added} 个用户`, 'success');
        renderUserManagement();
    }
}

async function handleRemoveUser(name) {
    if (!confirm(`确定要删除用户 "${name}" 吗？`)) return;
    if (await removeUser(name)) {
        showToast(`已删除用户 "${name}"`, 'success');
        renderUserManagement();
    }
}

// 登录
async function login() {
    const name = document.getElementById('photographerName').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    if (!name) {
        showToast('请输入用户名', 'error');
        return;
    }

    if (!password) {
        showToast('请输入密码', 'error');
        return;
    }

    if (isCloudMode()) {
        try {
            const response = await apiFetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: name, password })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || '用户名或密码错误');
            authToken = data.token;
            currentUser = data.user.username;

            if (rememberMe) {
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('currentUser', currentUser);
                localStorage.setItem('savedUsername', name);
                localStorage.setItem('rememberMe', 'true');
                localStorage.removeItem('savedPassword');
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('currentUser');
            } else {
                sessionStorage.setItem('authToken', authToken);
                sessionStorage.setItem('currentUser', currentUser);
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                localStorage.removeItem('savedUsername');
                localStorage.removeItem('savedPassword');
                localStorage.removeItem('rememberMe');
            }
            showMainPage();
            showToast('登录成功', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
        return;
    }

    const customPasswords = JSON.parse(localStorage.getItem('customPasswords') || '{}');
    const correctPassword = customPasswords[name] || USERS[name];
    if (USERS[name] && correctPassword === password) {
        currentUser = name;
        localStorage.setItem('currentUser', name);
        if (rememberMe) {
            localStorage.setItem('savedUsername', name);
            localStorage.setItem('savedPassword', password);
            localStorage.setItem('rememberMe', 'true');
        } else {
            localStorage.removeItem('savedUsername');
            localStorage.removeItem('savedPassword');
            localStorage.removeItem('rememberMe');
        }
        showMainPage();
        showToast('登录成功', 'success');
    } else {
        showToast('用户名或密码错误', 'error');
    }
}

// 游客登录
function guestLogin() {
    if (isCloudMode()) {
        showToast('线上模式请使用账号登录', 'error');
        return;
    }
    currentUser = '游客' + Math.floor(Math.random() * 10000);
    localStorage.setItem('currentUser', currentUser);
    showMainPage();
}

// 切换密码可见性
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('loginPassword');
    const eyeIcon = document.getElementById('eyeIcon');
    const toggleButton = document.querySelector('.toggle-password');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
        toggleButton?.setAttribute('aria-label', '隐藏密码');
        toggleButton?.setAttribute('aria-pressed', 'true');
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
        toggleButton?.setAttribute('aria-label', '显示密码');
        toggleButton?.setAttribute('aria-pressed', 'false');
    }
}

// ============ 修改密码功能 ============

// 显示修改密码弹窗
function showChangePasswordModal() {
    // 清空输入框
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    openAccessibleModal('changePasswordModal', '#currentPassword');
}

// 关闭修改密码弹窗
function closeChangePasswordModal() {
    closeAccessibleModal('changePasswordModal');
}

// 获取用户当前密码
function getCurrentUserPassword() {
    const customPasswords = JSON.parse(localStorage.getItem('customPasswords') || '{}');
    // 优先返回自定义密码，否则返回默认密码
    return customPasswords[currentUser] || USERS[currentUser];
}

// 修改密码
function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // 验证当前密码
    if (!currentPassword) {
        showToast('请输入当前密码', 'error');
        return;
    }

    if (isCloudMode()) {
        if (newPassword.length < 6 || newPassword !== confirmPassword) {
            showToast('请检查新密码', 'error');
            return;
        }
        apiFetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        }).then(async response => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || '密码修改失败');
            // 改密码会让所有旧 token 失效，后端会回一个新 token，必须换掉本地的，
            // 否则下一个请求就会被判成"密码已修改，请重新登录"。
            if (data.token) {
                authToken = data.token;
                if (localStorage.getItem('authToken')) localStorage.setItem('authToken', data.token);
                if (sessionStorage.getItem('authToken')) sessionStorage.setItem('authToken', data.token);
            }
            showToast('密码修改成功', 'success');
            closeChangePasswordModal();
        }).catch(error => showToast(error.message, 'error'));
        return;
    }

    const correctPassword = getCurrentUserPassword();
    if (currentPassword !== correctPassword) {
        showToast('当前密码错误', 'error');
        return;
    }

    // 验证新密码
    if (!newPassword) {
        showToast('请输入新密码', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('新密码至少需要6位', 'error');
        return;
    }

    // 验证确认密码
    if (newPassword !== confirmPassword) {
        showToast('两次输入的密码不一致', 'error');
        return;
    }

    // 保存新密码到 localStorage
    const customPasswords = JSON.parse(localStorage.getItem('customPasswords') || '{}');
    customPasswords[currentUser] = newPassword;
    localStorage.setItem('customPasswords', JSON.stringify(customPasswords));

    showToast('密码修改成功', 'success');
    closeChangePasswordModal();
}

// 退出登录
function logout() {
    if (confirm('确定要退出吗？')) {
        currentUser = null;
        authToken = null;
        allBookings = [];
        simpleVideoTasks = [];
        currentView = 'list';
        bookingsLoaded = false;
        bookingHistoryLoaded = false;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('authToken');
        stopAutoRefresh();
        stopStateRefresh();
        document.getElementById('loginPage').classList.remove('hidden');
        document.getElementById('mainPage').classList.add('hidden');
        document.getElementById('photographerName').value = '';
    }
}

// 显示主页面
function showMainPage() {
    allBookings = [];
    simpleVideoTasks = [];
    currentView = 'list';
    bookingsLoaded = false;
    bookingHistoryLoaded = false;
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('mainPage').classList.remove('hidden');
    document.getElementById('currentUser').textContent = currentUser;
    initStudioUI();
    renderBookingDateSwitcher();
    switchView('list');

    // admin 用户显示用户管理入口
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = currentUser === 'admin' ? '' : 'none';
    });
    loadSimpleVideoConfig();

    if (currentUser !== 'admin' && currentDateRange === 'yesterday') {
        currentDateRange = 'today';
        document.querySelectorAll('.date-btn').forEach(button => button.classList.remove('active'));
        document.getElementById('todayDateButton')?.classList.add('active');
    }

    // 确保移动端侧边栏初始状态为隐藏

    // 加载预约数据
    loadBookings();

    // 云端模式下启动自动刷新
    startAutoRefresh();
    // 状态刷新与网络无关，本地和云端都要跑
    startStateRefresh();
}

function isSimpleVideoEligibleStudio(studioId) {
    return Boolean(studioId && studioId !== '6F无影棚' && getStudioById(studioId)?.category === 'cyclorama');
}

async function loadSimpleVideoConfig() {
    document.querySelectorAll('.simple-video-link').forEach(el => el.classList.toggle('hidden', !isSimpleVideoRecipient()));
    if (isSimpleVideoRecipient()) loadSimpleVideoTasks();
}

function getSimpleVideoPhotographers(recipient = currentUser) {
    return Object.entries(SIMPLE_VIDEO_ASSIGNMENTS)
        .filter(([, assignedRecipient]) => assignedRecipient === recipient)
        .map(([photographer]) => photographer);
}

function isSimpleVideoRecipient(user = currentUser) {
    return getSimpleVideoPhotographers(user).length > 0;
}

async function loadSimpleVideoTasks() {
    if (isCloudMode()) {
        const response = await apiFetch('/api/simple-video/tasks').catch(() => null);
        simpleVideoTasks = response?.ok ? await response.json() : [];
    } else {
        const assignedPhotographers = new Set(getSimpleVideoPhotographers());
        simpleVideoTasks = allBookings
            .filter(booking => assignedPhotographers.has(booking.photographer)
                && booking.needsSimpleVideo
                && [getChinaDate(), getChinaDate(1)].includes(getDateOnly(booking.date)))
            .map(booking => {
                const simpleVideoTargetDate = getDateOnly(booking.date) === getChinaDate()
                    ? getChinaDate(1)
                    : getChinaDate(2);
                const simpleVideoBooking = allBookings.find(ownerBooking =>
                    ownerBooking.photographer === currentUser
                    && getDateOnly(ownerBooking.date) === simpleVideoTargetDate
                    && isSimpleVideoEligibleStudio(ownerBooking.studio)
                );
                return {
                    ...booking,
                    simpleVideoTargetDate,
                    simpleVideoCompleted: Boolean(simpleVideoBooking),
                    simpleVideoBookingId: simpleVideoBooking?.id || '',
                    simpleVideoStartTime: simpleVideoBooking?.startTime || '',
                    simpleVideoEndTime: simpleVideoBooking?.endTime || ''
                };
            });
    }
    updateSimpleVideoTaskBadge();
    renderSimpleVideoTasks();
}

function updateSimpleVideoTaskBadge() {
    const count = simpleVideoTasks.filter(task => !task.simpleVideoCompleted).length;
    const badge = document.getElementById('simpleVideoTaskBadge');
    if (badge) {
        badge.textContent = String(count);
        badge.classList.toggle('hidden', count === 0);
    }
    document.querySelectorAll('.simple-video-link').forEach(el => {
        el.classList.toggle('hidden', !isSimpleVideoRecipient());
    });
    // 待办入口收进了用户菜单，菜单收起时看不到角标，
    // 所以在菜单按钮上补一个小红点，未读时才显示。
    document.getElementById('userMenuDot')?.classList.toggle('hidden', count === 0);
}

function renderSimpleVideoTasks() {
    const container = document.getElementById('simpleVideoTasksContent');
    if (!container) return;
    container.innerHTML = simpleVideoTasks.length ? simpleVideoTasks.map(booking => `
        <article class="simple-video-task-card ${booking.simpleVideoCompleted ? 'is-booked' : 'is-pending'}">
            <div class="simple-video-task-info">
                <div class="simple-video-task-status">${booking.simpleVideoCompleted ? '已预约' : '待预约'}</div>
                <div class="simple-video-task-date">
                    <span class="simple-video-task-label">原预约</span>
                    <span>${escapeHtml(formatDate(booking.date))} ${escapeHtml(booking.startTime)}–${escapeHtml(booking.endTime)}</span>
                    <span class="simple-video-task-studio">${escapeHtml(booking.studio)}</span>
                </div>
                <div class="simple-video-task-time">简易视频：${booking.simpleVideoCompleted
                    ? `${escapeHtml(formatDate(booking.simpleVideoTargetDate))} ${escapeHtml(booking.simpleVideoStartTime)}-${escapeHtml(booking.simpleVideoEndTime)}`
                    : '未预约'}</div>
            </div>
            ${booking.simpleVideoCompleted
                ? `<button class="btn btn-secondary simple-video-task-action" onclick="showBookingDetail(${inlineJsString(booking.simpleVideoBookingId)})">查看/取消预约</button>`
                : `<button class="btn btn-primary simple-video-task-action" onclick="openSimpleVideoBooking(${inlineJsString(booking.id)}, ${inlineJsString(booking.simpleVideoTargetDate)})">去预约${escapeHtml(formatShortDate(booking.simpleVideoTargetDate))}</button>`}
        </article>`).join('') : '<p class="empty-message">暂无简易视频待办</p>';
}

function openSimpleVideoBooking(taskId, targetDate) {
    showAddBookingForm(undefined, null, { taskId, targetDate });
}

// 顶部日期条：展示整周 7 天，但只有真正能选的（今天/明天，管理员多一个昨天）可点。
// 未开放日期仍保留正常文字色；只有已经过去的日期置灰。
// 日期条的可选范围跟着当前视图走：6F 实景棚能提前一周约，其余仍是今天/明天。
// currentStudioFloor / currentStudioCategory 由 studio-layout.js 维护。
function getActiveBookingWindowDays() {
    return currentStudioFloor === '6F' && currentStudioCategory === 'real-scene'
        ? EXTENDED_BOOKING_WINDOW_DAYS
        : DEFAULT_BOOKING_WINDOW_DAYS;
}

function getMondayDate(date = getChinaDate()) {
    const [year, month, day] = date.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return shiftDate(date, -((weekday + 6) % 7));
}

function getBookingDateStripContext(isAdmin, windowDays) {
    return [
        currentStudioFloor || '',
        currentStudioCategory || '',
        isAdmin ? 'admin' : 'user',
        windowDays
    ].join('|');
}

function getToolbarDates() {
    const isAdmin = currentUser === 'admin';
    const windowDays = getActiveBookingWindowDays();
    const context = getBookingDateStripContext(isAdmin, windowDays);
    if (bookingDateStripContext !== context || !bookingDateStripStart) {
        bookingDateStripContext = context;
        bookingDateStripStart = getMondayDate();
    }

    const selectable = new Set(getSelectableDates({ isAdmin, windowDays }).map(item => item.date));
    return Array.from(
        { length: BOOKING_DATE_PAGE_SIZE },
        (_, index) => shiftDate(bookingDateStripStart, index)
    ).map(date => ({
        date,
        weekday: getWeekdayLabel(date),
        selectable: selectable.has(date),
        isPast: date < getChinaDate()
    }));
}

function renderBookingDateSwitcher() {
    const list = document.getElementById('bookingDateList');
    if (!list) return;

    const activeDate = selectedDate || getChinaDate();
    list.innerHTML = getToolbarDates().map(option => {
        const [, month, day] = option.date.split('-');
        const isActive = option.date === activeDate;
        const classes = ['booking-date-item'];
        if (isActive) classes.push('active');
        if (option.isPast) classes.push('is-past');
        if (!option.selectable) classes.push('is-locked');
        // 日期条统一显示星期几（例如周五、周六）；title 里给完整信息避免歧义
        const title = `${option.weekday} ${Number(month)}月${Number(day)}日${option.selectable ? '' : '（不在可预约范围内）'}`;
        return `<button type="button" class="${classes.join(' ')}" onclick="selectBookingDate('${option.date}')" aria-pressed="${isActive}" title="${escapeHtml(title)}"${option.selectable ? '' : ' disabled'}>
            <span class="booking-date-name">${option.weekday}</span>
            <small class="booking-date-detail">${Number(month)}.${Number(day)}</small>
        </button>`;
    }).join('');
}

function moveBookingDateStrip(weekOffset) {
    getToolbarDates();
    bookingDateStripStart = shiftDate(
        bookingDateStripStart,
        weekOffset * BOOKING_DATE_PAGE_SIZE
    );
    renderBookingDateSwitcher();
}

function selectBookingDate(date) {
    const options = { isAdmin: currentUser === 'admin', windowDays: getActiveBookingWindowDays() };
    if (!isSelectableDate(date, options)) return;
    selectedDate = date;
    currentDateRange = 'custom';
    renderBookingDateSwitcher();
    if (currentView === 'list') renderBookings();
}

// 标签切换
function showTab(tabName) {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.add('hidden'));

    if (tabName === 'booking') {
        document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
        document.getElementById('bookingTab').classList.remove('hidden');
    } else if (tabName === 'myBookings') {
        document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
        document.getElementById('myBookingsTab').classList.remove('hidden');
        renderMyBookings();
    }
}

// 加载预约数据（支持云端和本地）
// 迁移旧影棚名称到本次重新设计后的影棚配置，避免旧预约不显示。
function migrateStudioNames() {
    let changed = false;
    allBookings.forEach(booking => {
        const normalizedStudio = normalizeStudioName(booking.studio);
        if (booking.studio !== normalizedStudio) {
            booking.studio = normalizedStudio;
            changed = true;
        }
    });
    if (changed) {
        try {
            localStorage.setItem('bookings', JSON.stringify(allBookings));
            debugLog('✅ 已将旧影棚名称迁移到新版影棚配置');
        } catch (error) {
            console.error('迁移影棚名称保存失败:', error);
        }
    }
}

async function loadBookings({ includeHistory = bookingHistoryLoaded } = {}) {
    debugLog('开始加载预约数据...');

    if (isCloudMode()) {
        // 云端模式：从 API 加载
        const previousBookings = allBookings;
        try {
            // all=1 只有管理员能用，普通用户按需要的日期窗口取数。
            // 拉取范围要覆盖最长的预约窗口（6F 实景棚 7 天），
            // 否则那几天已有的预约在概览里看不到，会让人以为空着。
            const lastDay = Math.max(EXTENDED_BOOKING_WINDOW_DAYS - 1, isSimpleVideoRecipient() ? 2 : 1);
            const bookingPath = includeHistory
                ? '/api/bookings?all=1'
                : `/api/bookings?from=${getChinaDate(-1)}&to=${getChinaDate(lastDay)}`;
            const response = await apiFetch(bookingPath);
            if (!response.ok) {
                throw new Error(`加载失败: ${response.status}`);
            }
            allBookings = await response.json();

            // 标准化字段名：后端使用 notes，前端使用 note
            allBookings = allBookings.map(normalizeBookingRecord);
            bookingsLoaded = true;
            if (includeHistory) bookingHistoryLoaded = true;

            sortBookings();
            renderAllViews();
            if (isSimpleVideoRecipient()) loadSimpleVideoTasks();
            debugLog('✅ 从云端加载了', allBookings.length, '条预约');
            return true;
        } catch (error) {
            console.error('从云端加载预约失败:', error);
            showToast('加载数据失败，请检查网络', 'error');
            allBookings = previousBookings;
            bookingsLoaded = true;
            renderAllViews({ force: true });
            return false;
        }
    } else {
        // 本地模式：从 localStorage 加载
        try {
            const stored = localStorage.getItem('bookings');
            allBookings = stored ? JSON.parse(stored) : [];
            migrateStudioNames();
            bookingsLoaded = true;
            bookingHistoryLoaded = true;
            sortBookings();
            renderAllViews();
            if (isSimpleVideoRecipient()) loadSimpleVideoTasks();
            debugLog('✅ 从本地加载了', allBookings.length, '条预约');
            return true;
        } catch (error) {
            console.error('加载预约失败:', error);
            showToast('加载数据失败', 'error');
            allBookings = [];
            bookingsLoaded = true;
            renderAllViews({ force: true });
            return false;
        }
    }
}

function cloneBookings(bookings = allBookings) {
    return bookings.map(booking => ({ ...booking }));
}

function normalizeBookingRecord(booking) {
    const note = booking.notes || booking.note || '';
    return {
        ...booking,
        studio: normalizeStudioName(booking.studio),
        needsSimpleVideo: booking.needsSimpleVideo === true || booking.needsSimpleVideo === 'true',
        note,
        notes: note
    };
}

function upsertLocalBooking(booking) {
    const normalizedBooking = normalizeBookingRecord(booking);
    const index = allBookings.findIndex(item => item.id === normalizedBooking.id);
    if (index >= 0) {
        allBookings[index] = normalizedBooking;
    } else {
        allBookings.push(normalizedBooking);
    }
    sortBookings();
    renderAllViews({ force: true });
}

function removeLocalBooking(bookingId) {
    allBookings = allBookings.filter(booking => booking.id !== bookingId);
    renderAllViews({ force: true });
}

function restoreLocalBookings(snapshot) {
    allBookings = cloneBookings(snapshot);
    sortBookings();
    renderAllViews({ force: true });
}

// 保存预约数据到 localStorage（仅本地模式使用）
function saveBookings() {
    if (isCloudMode()) {
        // 云端模式不需要手动保存，API 会自动处理
        return;
    }
    try {
        localStorage.setItem('bookings', JSON.stringify(allBookings));
        debugLog('✅ 已保存', allBookings.length, '条预约到 localStorage');
    } catch (error) {
        console.error('保存预约失败:', error);
        showToast('保存数据失败', 'error');
    }
}

// 统一排序
function sortBookings() {
    allBookings.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
    });
}

// 渲染签名：只要它没变，重画出来的 DOM 就和现在完全一样，可以整轮跳过。
// 每 30 秒的轮询绝大多数时候拿回的是同一批数据，无谓重建 34 张卡片的 innerHTML
// 会打断 hover / 焦点，移动端还会掉滚动位置。
//
// 时间也要进签名：预约状态（未开始 / 进行中 / 已结束）会随时间翻转，
// 而所有预约时间都落在 15 分钟网格上，所以按 15 分钟取整就能覆盖全部状态切换点。
function getRenderSignature() {
    const bucketMinutes = Math.floor(timeToMinutes(getChinaCurrentTime()) / BOOKING_INTERVAL_MINUTES)
        * BOOKING_INTERVAL_MINUTES;
    const viewKey = [
        getChinaDate(),
        minutesToTime(bucketMinutes),
        currentView,
        currentDateRange,
        selectedDate,
        currentStudioCategory,
        currentUser,
        bookingsLoaded ? 1 : 0
    ].join('|');

    const bookingsKey = allBookings.map(booking => [
        booking.id,
        booking.studio,
        getDateOnly(booking.date),
        booking.startTime,
        booking.endTime,
        booking.photographer,
        booking.needsSimpleVideo ? 1 : 0,
        getBookingNote(booking)
    ].join(',')).join(';');

    return `${viewKey}#${bookingsKey}`;
}

let lastRenderSignature = null;

// 统一渲染所有视图
// force：DOM 结构刚被重建过（例如切换棚位分类）时必须强制重画。
function renderAllViews({ force = false } = {}) {
    const signature = getRenderSignature();
    if (!force && signature === lastRenderSignature) return;
    lastRenderSignature = signature;

    if (currentView === 'list') renderBookings();
    else if (currentView === 'stats') { initStatsView(); renderStatsView(); }
    updateTodayUsage();
}

// 渲染预约列表（列表视图）
// 根据日期筛选器显示预约
function renderBookings() {
    // 获取要显示的日期范围
    const displayDates = getDisplayDates();

    getAllStudios().forEach(studio => {
        const studioSummary = document.getElementById(getStudioListId(studio.id));
        if (!studioSummary) return;

        const studioBookings = getStudioBookingsForDates(studio.id, displayDates);
        const studioCard = studioSummary.closest('.studio-overview-card');
        const frozen = isStudioFrozen(studio.id);
        const fullyBooked = !frozen && isStudioFullyBooked(studio.id, displayDates);
        const partiallyBooked = !frozen && !fullyBooked && studioBookings.length > 0;
        const bookedPercentage = getStudioBookedPercentage(studioBookings, displayDates);
        if (studioCard) {
            studioCard.classList.toggle('studio-fully-booked', fullyBooked);
            studioCard.classList.toggle('studio-partially-booked', partiallyBooked);
            studioCard.classList.toggle('has-bookings', studioBookings.length > 0);
            studioCard.title = frozen
                ? '该棚位暂时冻结，无法预约'
                : fullyBooked
                    ? '当前日期已约满'
                    : partiallyBooked
                        ? '当前日期已有预约，仍有可预约时间'
                        : '';

            const statusLabel = studioCard.querySelector('.real-scene-status-label');
            if (statusLabel) {
                statusLabel.textContent = fullyBooked ? '已约满' : partiallyBooked ? '部分预约' : '可预约';
            }

            const occupancy = studioCard.querySelector('.real-scene-occupancy');
            const occupancyFill = occupancy?.querySelector('i');
            const occupancyText = occupancy?.querySelector('small');
            if (occupancy && occupancyFill && occupancyText) {
                occupancy.setAttribute('aria-label', `已预约时段占比 ${bookedPercentage}%`);
                occupancyFill.style.width = `${bookedPercentage}%`;
                occupancyText.textContent = `${bookedPercentage}%`;
            }
        }

        studioSummary.innerHTML = createStudioSummary(studio, studioBookings);
    });
}

function getStudioBookedPercentage(studioBookings, dates) {
    return getBookedSlotPercentage(studioBookings, dates);
}

function getStudioBookingsForDates(studioId, dates, bookingsToUse = allBookings) {
    return bookingsToUse
        .filter(booking => booking.studio === studioId && dates.includes(getDateOnly(booking.date)))
        .sort(compareBookingsByTime);
}

function compareBookingsByTime(a, b) {
    const aDate = getDateOnly(a.date);
    const bDate = getDateOnly(b.date);
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return a.startTime.localeCompare(b.startTime);
}

function getTodayBookingCount(studioId) {
    const today = getChinaDate();
    return allBookings.filter(booking =>
        booking.studio === studioId && getDateOnly(booking.date) === today
    ).length;
}

function getStudioLiveState(studioBookings) {
    const today = getChinaDate();
    const currentTime = getChinaCurrentTime();

    const activeBooking = studioBookings.find(booking =>
        getDateOnly(booking.date) === today &&
        booking.startTime <= currentTime &&
        currentTime < booking.endTime
    );

    if (activeBooking) {
        return {
            type: 'busy',
            label: '正在使用',
            booking: activeBooking
        };
    }

    const nextBooking = studioBookings.find(booking => {
        const bookingDate = getDateOnly(booking.date);
        if (bookingDate < today) return false;
        if (bookingDate === today && booking.endTime <= currentTime) return false;
        return true;
    });

    if (nextBooking) {
        return {
            type: 'upcoming',
            label: '下一场',
            booking: nextBooking
        };
    }

    return {
        type: 'free',
        label: '空闲',
        booking: null
    };
}

function formatShortDate(dateStr) {
    const dateOnly = getDateOnly(dateStr);
    const today = getChinaDate();
    const tomorrowStr = getChinaDate(1);

    if (dateOnly === today) return '今天';
    if (dateOnly === tomorrowStr) return '明天';
    return dateOnly.slice(5);
}

function getBookableStartDate() {
    return getChinaDate();
}

// 预约窗口按棚位算：6F 实景棚 7 天，其余今天/明天。
function getBookableEndDate(studio) {
    const dates = getBookableDates(studio);
    return dates[dates.length - 1];
}

function isBookableDate(date, studio) {
    return isValidBookingDate(date, studio);
}

function getDefaultBookingDate(studio) {
    const displayDate = getDisplayDates()[0];
    return isBookableDate(displayDate, studio) ? displayDate : getBookableStartDate();
}

function hasAvailableBookingSlot(studioId, date) {
    if (!isBookableDate(date, studioId)) return false;

    const today = getBookableStartDate();
    const currentTime = getChinaCurrentTime();
    const existingBookings = getStudioBookingsForDates(studioId, [date]);
    const startTimes = getBookingStartTimes();

    return startTimes.some(startTime => {
        if (date === today && startTime < currentTime) return false;

        const endTime = minutesToTime(timeToMinutes(startTime) + BOOKING_INTERVAL_MINUTES);
        return !existingBookings.some(booking =>
            hasTimeOverlap(startTime, endTime, booking.startTime, booking.endTime)
        );
    });
}

function isStudioFullyBooked(studioId, dates) {
    const bookableDates = dates.filter(date => isBookableDate(date, studioId));
    if (bookableDates.length === 0) return false;

    return bookableDates.every(date => !hasAvailableBookingSlot(studioId, date));
}

function getBookingNote(booking) {
    return booking.note || booking.notes || '';
}

function createStudioSummary(studio, studioBookings) {
    const bookingRows = studioBookings.length === 0
        ? ''
        : studioBookings.map(booking => {
            const status = getBookingStatus(booking);
            const isCancellable = canCancelBooking(booking);
            const bookingId = inlineJsString(booking.id);
            return `
            <div
                class="studio-summary-booking ${status}${isCancellable ? ' cancellable' : ''}"
                onclick="openSummaryBooking(event, ${bookingId})"
                role="button"
                tabindex="0"
                onkeydown="handleSummaryBookingKeydown(event, ${bookingId})"
            >
                <strong>${booking.startTime}-${booking.endTime}</strong>
                <span class="summary-booking-user">${escapeHtml(booking.photographer)}</span>
                ${status === 'completed' ? '<span class="summary-expired-label">已过期</span>' : ''}
            </div>
        `;
        }).join('');

    return `
        <div class="studio-summary-bookings">
            ${bookingRows}
        </div>
    `;
}

function openSummaryBooking(event, bookingId) {
    event.stopPropagation();
    showBookingDetail(bookingId);
}

function handleSummaryBookingKeydown(event, bookingId) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        showBookingDetail(bookingId);
    }
}

function getAvailabilitySlotState(time, selectedDate, existingBookings) {
    const today = getChinaDate();
    const currentTime = getChinaCurrentTime();
    const isPeriodEnd = BOOKABLE_PERIODS.some(period => period.end === time);
    const isPast = selectedDate === today && time < currentTime;

    const booking = existingBookings.find(item =>
        time >= item.startTime && (time < item.endTime || (isPeriodEnd && time === item.endTime))
    );
    if (booking) {
        return {
            type: 'booked',
            label: `${booking.startTime}-${booking.endTime} ${booking.photographer}`,
            booking,
            isPast
        };
    }

    if (isPast) {
        return { type: 'past', label: '已过' };
    }

    return { type: 'free', label: '可约' };
}

function getAvailableTimeRanges(period, selectedDate, existingBookings) {
    const today = getChinaDate();
    const currentTime = getChinaCurrentTime();
    const startTimes = getTimeOptions(period.start, period.end).slice(0, -1);
    const ranges = [];
    let rangeStart = '';

    startTimes.forEach(startTime => {
        const endTime = minutesToTime(timeToMinutes(startTime) + BOOKING_INTERVAL_MINUTES);
        const isPast = selectedDate === today && startTime < currentTime;
        const isBooked = existingBookings.some(booking =>
            hasTimeOverlap(startTime, endTime, booking.startTime, booking.endTime)
        );

        if (!isPast && !isBooked) {
            if (!rangeStart) rangeStart = startTime;
            return;
        }

        if (rangeStart) {
            ranges.push({ start: rangeStart, end: startTime });
            rangeStart = '';
        }
    });

    if (rangeStart) ranges.push({ start: rangeStart, end: period.end });
    return ranges;
}

function renderAvailableRanges(period, selectedDate, existingBookings) {
    const ranges = getAvailableTimeRanges(period, selectedDate, existingBookings);
    if (ranges.length === 0) {
        return '<span class="availability-period-ranges no-availability">暂无空档</span>';
    }

    const text = ranges.map(range => `${range.start}-${range.end}`).join('、');
    return `<span class="availability-period-ranges">可约 ${text}</span>`;
}

function findNextBlockedTime(startTime, existingBookings) {
    let blockedFrom = BOOKING_END_TIME;

    existingBookings.forEach(booking => {
        if (booking.startTime > startTime && booking.startTime < blockedFrom) {
            blockedFrom = booking.startTime;
        }
        if (startTime >= booking.startTime && startTime < booking.endTime) {
            blockedFrom = booking.startTime;
        }
    });

    return blockedFrom;
}

function updateEndTimeOptions(startTime, endTimeSelect, existingBookings) {
    const blockedFrom = findNextBlockedTime(startTime, existingBookings);
    const selectedPeriod = getBookablePeriod(startTime);
    const endOptions = endTimeSelect.querySelectorAll('option');

    endOptions.forEach(option => {
        if (option.value === '') {
            option.disabled = false;
            return;
        }

        const tooEarly = option.value <= startTime;
        const tooLate = option.value > blockedFrom;
        const wrongPeriod = !selectedPeriod || getBookablePeriod(option.value) !== selectedPeriod;
        option.disabled = tooEarly || tooLate || wrongPeriod;
    });

    const selectedEndOption = Array.from(endOptions).find(option => option.value === endTimeSelect.value);
    if (endTimeSelect.value && (!selectedEndOption || selectedEndOption.disabled)) {
        endTimeSelect.value = '';
    }
}

function renderAvailabilityPanel() {
    const studioSelect = document.getElementById('studioSelect');
    const dateInput = document.getElementById('bookingDate');
    const timeline = document.getElementById('availabilityTimeline');
    const bookingsList = document.getElementById('availabilityBookings');
    const subtitle = document.getElementById('availabilitySubtitle');
    const startTimeSelect = document.getElementById('startTime');

    if (!studioSelect || !dateInput || !timeline || !bookingsList || !subtitle) return;

    const studio = studioSelect.value;
    const selectedDate = dateInput.value;
    const studioInfo = getStudioById(studio);
    const existingBookings = allBookings
        .filter(booking => booking.id !== editingBookingId
            && booking.studio === studio
            && getDateOnly(booking.date) === selectedDate)
        .sort(compareBookingsByTime);

    subtitle.textContent = studioInfo
        ? `${studioInfo.title} · ${formatDate(selectedDate)}`
        : '选择影棚和日期后查看';

    const selectedStartTime = startTimeSelect ? startTimeSelect.value : '';
    const selectedEndTime = document.getElementById('endTime')?.value || '';
    const times = getTimeOptions(BOOKING_START_TIME, BOOKING_END_TIME);

    const renderAvailabilitySlot = time => {
        let state = getAvailabilitySlotState(time, selectedDate, existingBookings);
        const isClosingTime = BOOKABLE_PERIODS.some(period => period.end === time);
        if (isClosingTime && state.type === 'free') {
            state = { type: 'closing', label: `${time} 结束时间` };
        }
        const isStart = selectedStartTime === time;
        const isRange = selectedStartTime && selectedEndTime && time > selectedStartTime && time < selectedEndTime;
        const isEnd = selectedEndTime === time;
        const selectedClass = [
            isStart ? ' selected-start' : '',
            isRange ? ' selected-range' : '',
            isEnd ? ' selected-end' : ''
        ].join('');
        const canSelectBookedBoundary = state.type === 'booked'
            && !state.isPast
            && selectedStartTime
            && state.booking
            && time === state.booking.startTime
            && selectedStartTime < time;
        const canSelect = state.type === 'free' || state.type === 'closing' || canSelectBookedBoundary;
        const canManageBooking = state.type === 'booked'
            && state.booking
            && canCancelBooking(state.booking)
            && !canSelectBookedBoundary;
        const slotClass = `availability-${state.type}${state.isPast ? ' availability-past' : ''}${canSelectBookedBoundary ? ' availability-booked-boundary' : ''}${canManageBooking ? ' availability-owned-booking' : ''}${selectedClass}`;
        const photographerName = state.type === 'booked' && state.booking
            ? escapeHtml(state.booking.photographer || '')
            : '';
        const clickAction = canSelect
            ? `selectAvailabilityTime('${time}')`
            : canManageBooking
                ? `openAvailabilityBooking(${inlineJsString(state.booking.id)})`
                : '';
        return `
            <button
                type="button"
                class="availability-slot ${slotClass}"
                ${clickAction ? `onclick="${clickAction}"` : 'disabled'}
                title="${escapeHtml(state.label)}"
            >
                <span>${time}</span>
                ${photographerName ? `<small>${photographerName}</small>` : ''}
            </button>
        `;
    };

    const morningTimes = times.filter(time => time >= '08:30' && time <= '12:30');
    const afternoonTimes = times.filter(time => time >= '14:00' && time <= '18:30');
    const morningPeriod = BOOKABLE_PERIODS[0];
    const afternoonPeriod = BOOKABLE_PERIODS[1];
    timeline.innerHTML = `
        <section class="availability-period">
            <div class="availability-period-title">
                <span>上午</span>
                ${renderAvailableRanges(morningPeriod, selectedDate, existingBookings)}
            </div>
            <div class="availability-period-grid">
                ${morningTimes.map(renderAvailabilitySlot).join('')}
            </div>
        </section>
        <section class="availability-period">
            <div class="availability-period-title">
                <span>下午</span>
                ${renderAvailableRanges(afternoonPeriod, selectedDate, existingBookings)}
            </div>
            <div class="availability-period-grid">
                ${afternoonTimes.map(renderAvailabilitySlot).join('')}
            </div>
        </section>
    `;

    if (existingBookings.length === 0) {
        bookingsList.innerHTML = '<p class="availability-empty">当天还没有预约，整段时间都比较空。</p>';
        return;
    }

    bookingsList.innerHTML = existingBookings.map(booking => {
        const content = `
            <strong>${booking.startTime}-${booking.endTime}</strong>
            <span>${escapeHtml(booking.photographer)}</span>
            ${getBookingNote(booking) ? `<em>${escapeHtml(getBookingNote(booking))}</em>` : ''}
        `;
        if (!canCancelBooking(booking)) {
            return `<div class="availability-booking-item">${content}</div>`;
        }
        return `
            <button
                type="button"
                class="availability-booking-item manageable"
                onclick="openAvailabilityBooking(${inlineJsString(booking.id)})"
                title="点击修改或取消该预约"
            >${content}</button>
        `;
    }).join('');
}

function openAvailabilityBooking(bookingId) {
    const booking = allBookings.find(item => item.id === bookingId);
    if (!booking || !canCancelBooking(booking)) return;
    closeAddBookingForm();
    showBookingDetail(bookingId);
}

function selectAvailabilityTime(time) {
    const startTimeSelect = document.getElementById('startTime');
    const endTimeSelect = document.getElementById('endTime');
    const studio = document.getElementById('studioSelect').value;
    const date = document.getElementById('bookingDate').value;
    const existingBookings = allBookings
        .filter(booking => booking.id !== editingBookingId
            && booking.studio === studio
            && getDateOnly(booking.date) === date)
        .sort(compareBookingsByTime);

    if (endTimeSelect.value === time) {
        endTimeSelect.value = '';
        renderAvailabilityPanel();
        return;
    }

    if (startTimeSelect.value === time) {
        startTimeSelect.value = '';
        endTimeSelect.value = '';
        renderAvailabilityPanel();
        return;
    }

    const periodEndingAtTime = BOOKABLE_PERIODS.find(period => period.end === time);
    if (periodEndingAtTime && !startTimeSelect.value) {
        startTimeSelect.value = minutesToTime(timeToMinutes(time) - BOOKING_INTERVAL_MINUTES);
        endTimeSelect.value = time;
        startTimeSelect.dispatchEvent(new Event('change'));
        renderAvailabilityPanel();
        return;
    }

    if (!startTimeSelect.value || time <= startTimeSelect.value) {
        startTimeSelect.value = time;
        endTimeSelect.value = '';
        startTimeSelect.dispatchEvent(new Event('change'));
    } else {
        updateEndTimeOptions(startTimeSelect.value, endTimeSelect, existingBookings);
        const endOption = Array.from(endTimeSelect.options).find(option =>
            option.value === time && !option.disabled
        );

        if (endOption) {
            endTimeSelect.value = time;
        } else {
            startTimeSelect.value = time;
            endTimeSelect.value = '';
            startTimeSelect.dispatchEvent(new Event('change'));
        }
    }

    updateEndTimeOptions(startTimeSelect.value, endTimeSelect, existingBookings);

    renderAvailabilityPanel();
}

// 创建预约卡片
function createBookingCard(booking) {
    const isMyBooking = booking.photographer === currentUser;
    const myBookingClass = isMyBooking ? 'my-booking' : '';
    const studioInfo = getStudioById(booking.studio);
    const studioGroup = studioInfo ? studioInfo.groupKey : 'unknown';
    const bookingId = inlineJsString(booking.id);
    const note = getBookingNote(booking);

    // 判断预约状态
    const status = getBookingStatus(booking);
    const statusClass = status === 'completed' ? 'booking-completed' : '';
    const expiredLabel = status === 'completed' ? '<div class="expired-label">已过期</div>' : '';

    return `
        <div class="booking-card ${myBookingClass} ${statusClass}" data-studio="${escapeHtml(booking.studio)}" data-studio-group="${escapeHtml(studioGroup)}" onclick="showBookingDetail(${bookingId})">
            ${expiredLabel}
            <div class="booking-info">
                <div class="booking-time">${booking.startTime} - ${booking.endTime}</div>
                <div class="booking-date">${formatDate(booking.date)}</div>
                <div class="booking-photographer">📷 ${escapeHtml(booking.photographer)}</div>
            </div>
            ${note ? `<div class="booking-note">${escapeHtml(note)}</div>` : ''}
        </div>
    `;
}

// 格式化日期
function formatDate(dateStr) {
    // 处理 ISO 格式日期，只取日期部分
    const dateOnly = dateStr.split('T')[0];
    const today = getChinaDate();
    const tomorrow = getChinaDate(1);

    if (dateOnly === today) {
        return '今天 ' + dateOnly;
    } else if (dateOnly === tomorrow) {
        return '明天 ' + dateOnly;
    } else {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const date = new Date(`${dateOnly}T12:00:00+08:00`);
        return `${dateOnly} ${weekdays[date.getDay()]}`;
    }
}

// 显示新建预约表单
function showAddBookingForm(defaultStudio, bookingToEdit = null, simpleVideoTask = null) {
    if (currentUser && currentUser.startsWith('游客')) {
        alert('游客模式不能预约，请登录后操作。');
        return;
    }
    if (!bookingToEdit && currentDateRange === 'yesterday') {
        return;
    }
    const normalizedDefaultStudio = defaultStudio ? normalizeStudioName(defaultStudio) : '';
    if (!bookingToEdit && normalizedDefaultStudio && isStudioFrozen(normalizedDefaultStudio)) {
        showToast('该影棚暂时冻结，无法预约', 'error');
        return;
    }
    simpleVideoBookingContext = simpleVideoTask || (getDateOnly(bookingToEdit?.date) === getChinaDate(2)
        ? { taskId: '', targetDate: getChinaDate(2) }
        : null);
    editingBookingId = bookingToEdit?.id || null;
    document.getElementById('bookingModalTitle').textContent = editingBookingId
        ? '修改预约时间'
        : simpleVideoBookingContext ? '预约简易视频' : '预约';
    document.getElementById('bookingSubmitButton').textContent = editingBookingId ? '保存修改' : '确认预约';
    // 重置表单
    const studioSelect = document.getElementById('studioSelect');
    if (defaultStudio) {
        studioSelect.value = normalizedDefaultStudio;
    } else {
        studioSelect.value = getDefaultStudioId();
    }

    // 可选日期范围跟着棚位走：6F 实景棚 7 天，其余今天/明天；
    // 简易视频待办则锁定在摄影次日那一天。
    const dateInput = document.getElementById('bookingDate');
    const defaultDate = bookingToEdit
        ? getDateOnly(bookingToEdit.date)
        : simpleVideoBookingContext?.targetDate || getDefaultBookingDate(studioSelect.value);

    const applyDateRange = () => {
        const studio = studioSelect.value;
        dateInput.min = simpleVideoBookingContext?.targetDate || getBookableStartDate();
        dateInput.max = simpleVideoBookingContext?.targetDate || getBookableEndDate(studio);
        // 换到窗口更短的棚位时，原来选的日期可能已经越界，收回到可选范围内
        if (!simpleVideoBookingContext && dateInput.value && !isBookableDate(dateInput.value, studio)) {
            dateInput.value = getBookableStartDate();
        }
    };
    dateInput.value = defaultDate;
    applyDateRange();
    const simpleVideoOption = document.getElementById('simpleVideoBookingOption');
    const simpleVideoCheckbox = document.getElementById('needsSimpleVideo');
    const simpleVideoHint = document.getElementById('simpleVideoBookingHint');
    const simpleVideoState = document.getElementById('simpleVideoBookingState');
    document.getElementById('bookingNote').value = bookingToEdit ? getBookingNote(bookingToEdit) : '';
    const updateSimpleVideoOption = ({ syncValue = true } = {}) => {
        const eligible = !isSimpleVideoRecipient()
            && !simpleVideoBookingContext
            && isSimpleVideoEligibleStudio(studioSelect.value)
            && isBookableDate(dateInput.value, studioSelect.value);
        simpleVideoOption?.classList.toggle('hidden', !eligible);
        if (simpleVideoCheckbox) {
            if (syncValue) simpleVideoCheckbox.checked = eligible && Boolean(bookingToEdit?.needsSimpleVideo);
            simpleVideoCheckbox.disabled = !eligible;
            simpleVideoState.textContent = simpleVideoCheckbox.checked ? '已选择' : '未选择';
        }
        if (simpleVideoHint) {
            const targetDate = dateInput.value === getChinaDate() ? getChinaDate(1) : getChinaDate(2);
            simpleVideoHint.textContent = eligible
                ? `系统会为${formatDate(targetDate)}生成简易视频待办`
                : '可为对应人员安排后续的简易视频拍摄';
        }
    };
    updateSimpleVideoOption();
    if (simpleVideoCheckbox) {
        simpleVideoCheckbox.onchange = () => updateSimpleVideoOption({ syncValue: false });
    }
    document.getElementById('startTime').value = bookingToEdit?.startTime || '';
    document.getElementById('endTime').value = bookingToEdit?.endTime || '';
    const startTimeSelect = document.getElementById('startTime');
    const endTimeSelect = document.getElementById('endTime');
    renderTimeSelectOptions();

    startTimeSelect.value = bookingToEdit?.startTime || '';
    endTimeSelect.value = bookingToEdit?.endTime || '';

    // 根据选择的日期和当前时间，禁用已过去的开始时间
    function updateStartTimeOptions() {
        const validDate = simpleVideoBookingContext
            ? dateInput.value === simpleVideoBookingContext.targetDate
            : isBookableDate(dateInput.value, studioSelect.value);
        if (!validDate) {
            dateInput.value = defaultDate;
        }

        const selectedDate = dateInput.value;
        const today = getChinaDate();
        const currentTime = getChinaCurrentTime();

        const studio = document.getElementById('studioSelect').value;

        // 获取该影棚该日期的已有预约
        const existingBookings = allBookings.filter(b =>
            b.id !== editingBookingId && b.studio === studio && getDateOnly(b.date) === selectedDate
        );

        const startOptions = startTimeSelect.querySelectorAll('option');

        startOptions.forEach(option => {
            if (option.value === '') {
                option.disabled = false;
                return;
            }

            // 禁用已过去的时间（今天）
            let disabled = selectedDate === today && option.value < currentTime;

            // 禁用已被占用的时间段内的开始时间
            if (!disabled) {
                disabled = existingBookings.some(b =>
                    option.value >= b.startTime && option.value < b.endTime
                );
            }

            option.disabled = disabled;
        });

        // 如果当前选择的开始时间被禁用了，清空选择
        if (startTimeSelect.value && startOptions[startTimeSelect.selectedIndex]?.disabled) {
            startTimeSelect.value = '';
            endTimeSelect.value = '';
        }

        renderAvailabilityPanel();
    }

    // 日期或影棚变化时更新开始时间选项
    dateInput.onchange = () => {
        updateSimpleVideoOption();
        updateStartTimeOptions();
    };
    document.getElementById('studioSelect').onchange = () => {
        // 换棚位可能改变可选日期范围（6F 实景棚 7 天 vs 其余今天/明天）
        applyDateRange();
        updateSimpleVideoOption();
        updateStartTimeOptions();
    };

    // 初始化时更新一次
    updateStartTimeOptions();

    // 添加开始时间变化监听，自动更新结束时间选项
    startTimeSelect.onchange = function() {
        const startTime = this.value;
        if (!startTime) return;

        const studio = document.getElementById('studioSelect').value;
        const date = dateInput.value;

        // 获取该影棚该日期的已有预约
        const existingBookings = allBookings.filter(b =>
            b.id !== editingBookingId && b.studio === studio && getDateOnly(b.date) === date
        );

        updateEndTimeOptions(startTime, endTimeSelect, existingBookings);

        renderAvailabilityPanel();
    };

    if (startTimeSelect.value) {
        startTimeSelect.dispatchEvent(new Event('change'));
    }
    endTimeSelect.onchange = renderAvailabilityPanel;
    openAccessibleModal('addBookingModal', '#studioSelect');
    startBookingAvailabilityRefresh();
}

// 关闭新建预约表单
function closeAddBookingForm() {
    const modal = document.getElementById('addBookingModal');
    if (modal) {
        closeAccessibleModal('addBookingModal');
        stopBookingAvailabilityRefresh();
        editingBookingId = null;
        simpleVideoBookingContext = null;
        document.getElementById('bookingModalTitle').textContent = '预约';
        document.getElementById('bookingSubmitButton').textContent = '确认预约';
        debugLog('弹窗已关闭');
    }
}

// 添加预约
async function addBooking() {
    debugLog('=== addBooking 函数被调用 ===');

    if (bookingSaveInFlight) return;

    const studio = document.getElementById('studioSelect').value;
    const date = document.getElementById('bookingDate').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const originalBooking = editingBookingId
        ? allBookings.find(booking => booking.id === editingBookingId)
        : null;
    const note = document.getElementById('bookingNote').value.trim();
    const needsSimpleVideo = !isSimpleVideoRecipient()
        && !simpleVideoBookingContext
        && isSimpleVideoEligibleStudio(studio)
        && document.getElementById('needsSimpleVideo')?.checked === true;

    debugLog('提交预约:', { studio, date, startTime, endTime, note });

    // 验证
    if (!date || !startTime || !endTime) {
        showToast('请填写完整的预约信息', 'error');
        return;
    }

    const validBookingDate = simpleVideoBookingContext
        ? date === simpleVideoBookingContext.targetDate
        : isBookableDate(date, studio);
    if (!validBookingDate) {
        const days = getBookingWindowDays(studio);
        showToast(days > 2 ? `该影棚只能预约未来 ${days} 天内的日期` : '只能预约今天或明天的影棚', 'error');
        return;
    }

    if (!getStudioById(studio)) {
        showToast('请选择有效的影棚', 'error');
        return;
    }

    if (isStudioFrozen(studio)) {
        showToast('该影棚暂时冻结，无法预约', 'error');
        return;
    }

    if (startTime >= endTime) {
        showToast('结束时间必须晚于开始时间', 'error');
        return;
    }

    if (!isValidBookingRange(startTime, endTime)) {
        showToast('预约时间必须在上午或下午营业时段内', 'error');
        return;
    }

    if (!isBookingStartAvailable(date, startTime)) {
        showToast('该开始时间已过期，请选择当前时间之后的时段', 'error');
        return;
    }

    // 检查时间冲突
    const hasConflict = allBookings.some(booking => {
        if (booking.id === editingBookingId) return false;
        if (booking.studio !== studio || getDateOnly(booking.date) !== date) {
            return false;
        }

        return hasTimeOverlap(startTime, endTime, booking.startTime, booking.endTime);
    });

    if (hasConflict) {
        showToast('该时间段已被预约，请选择其他时间', 'error');
        return;
    }

    // 创建新预约对象
    const activeEditingId = editingBookingId;
    const isEditing = Boolean(activeEditingId);
    const newBooking = {
        id: activeEditingId || createBookingId(), // 修改时保留原预约 ID
        studio: studio,
        date: date,
        startTime: startTime,
        endTime: endTime,
        photographer: originalBooking?.photographer || currentUser,
        contact: originalBooking?.contact || currentUser,
        note: note,
        notes: note, // 后端字段名是 notes
        needsSimpleVideo,
        simpleVideoTaskId: simpleVideoBookingContext?.taskId || '',
        createdAt: new Date().toISOString() // 使用 ISO 格式
    };

    const previousBookings = cloneBookings();
    const submitButton = document.getElementById('bookingSubmitButton');

    try {
        bookingSaveInFlight = true;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = isEditing ? '保存中...' : '预约中...';
        }

        if (isCloudMode()) {
            upsertLocalBooking(newBooking);
            closeAddBookingForm();
            showToast(isEditing ? '正在同步修改...' : '正在同步预约...', 'success');

            // 云端模式：调用 API
            debugLog('正在保存预约到云端...');
            const response = await apiFetch(activeEditingId ? `/api/bookings/${activeEditingId}` : '/api/bookings', {
                method: activeEditingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newBooking)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `服务器错误: ${response.status}`);
            }

            const savedBooking = await response.json().catch(() => newBooking);
            upsertLocalBooking(savedBooking);
        } else {
            // 本地模式：保存到 localStorage
            debugLog('正在保存预约到 localStorage...');
            upsertLocalBooking(newBooking);
            saveBookings();
            closeAddBookingForm();
        }

        if (isSimpleVideoRecipient()) loadSimpleVideoTasks();

        debugLog('✅ 预约保存成功');
        showToast(isEditing ? '预约时间已修改' : '预约成功', 'success');

    } catch (error) {
        restoreLocalBookings(previousBookings);
        console.error('❌ 预约失败:', error);
        showToast('预约失败：' + error.message, 'error');
    } finally {
        bookingSaveInFlight = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = isEditing ? '保存修改' : '确认预约';
        }
    }
}

function showStudioDetail(studioId) {
    const normalizedStudioId = normalizeStudioName(studioId);
    const studio = getStudioById(normalizedStudioId);
    if (!studio) return;

    selectedBookingId = null;
    const displayDates = getDisplayDates();
    const studioBookings = getStudioBookingsForDates(studio.id, displayDates);
    const state = getStudioLiveState(studioBookings);
    const todayCount = getTodayBookingCount(studio.id);

    const bookingListHtml = studioBookings.length === 0
        ? '<p class="studio-detail-empty">当前日期范围暂无预约</p>'
        : studioBookings.map(booking => createStudioDetailBookingItem(booking)).join('');

    document.getElementById('bookingDetailContent').innerHTML = `
        <div class="studio-detail-overview" data-studio-group="${studio.groupKey}">
            <div class="studio-detail-heading">
                <span class="studio-type-badge">${escapeHtml(studio.groupOptionLabel)}</span>
                <h3>${escapeHtml(studio.title)}</h3>
                <p>位置：${escapeHtml(studio.location || studio.groupTitle)}</p>
            </div>
            <div class="studio-detail-status studio-summary-${state.type}">
                <span class="studio-status-dot"></span>
                <span>${state.label}</span>
            </div>
            <div class="studio-detail-stats">
                <span>今日 ${todayCount} 场</span>
                <span>当前范围 ${studioBookings.length} 场</span>
            </div>
        </div>
        <div class="studio-detail-list">
            ${bookingListHtml}
        </div>
    `;

    document.getElementById('detailActions').innerHTML = `
        <button onclick="openAddBookingFromStudioDetail('${escapeHtml(studio.id)}')" class="btn ${studio.buttonClass}">预约</button>
    `;

    openAccessibleModal('bookingDetailModal', '.close-btn');
}

function createStudioDetailBookingItem(booking) {
    const status = getBookingStatus(booking);
    const statusText = status === 'ongoing' ? '进行中' : status === 'completed' ? '已结束' : '未开始';
    const note = getBookingNote(booking);
    const bookingId = inlineJsString(booking.id);
    const studioId = inlineJsString(booking.studio);
    const cancelButtonHtml = canCancelBooking(booking)
        ? `<button type="button" class="studio-detail-booking-cancel" onclick="cancelBookingFromStudioDetail(event, ${bookingId}, ${studioId})">取消</button>`
        : '';

    return `
        <div
            class="studio-detail-booking ${status}"
            onclick="showBookingDetail(${bookingId})"
            role="button"
            tabindex="0"
            onkeydown="handleStudioDetailBookingKeydown(event, ${bookingId})"
        >
            <span class="studio-detail-booking-time">${formatShortDate(booking.date)} ${booking.startTime}-${booking.endTime}</span>
            <span class="studio-detail-booking-user">${escapeHtml(booking.photographer)}</span>
            <span class="studio-detail-booking-status">${statusText}</span>
            ${cancelButtonHtml}
            ${note ? `<span class="studio-detail-booking-note">${escapeHtml(note)}</span>` : ''}
        </div>
    `;
}

function handleStudioDetailBookingKeydown(event, bookingId) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showBookingDetail(bookingId);
    }
}

function canCancelBooking(booking) {
    return Boolean(
        booking
        && currentUser
        && isBookingEditable(booking)
        && (booking.photographer === currentUser || currentUser === 'admin')
    );
}

async function cancelBookingFromStudioDetail(event, bookingId, studioId) {
    event.stopPropagation();
    showCancelBookingConfirm(bookingId, studioId);
}

function showCancelBookingConfirm(bookingId, studioId = '') {
    const booking = allBookings.find(item => item.id === bookingId);
    if (!booking) return;
    if (!canCancelBooking(booking)) {
        showToast(getBookingStatus(booking) === 'completed' ? '已结束预约不能取消' : '只能取消自己的预约', 'error');
        return;
    }

    pendingCancelBookingId = bookingId;
    pendingCancelStudioId = studioId;

    const note = getBookingNote(booking);
    const content = document.getElementById('cancelBookingContent');
    if (!content) return;

    content.innerHTML = `
        <div class="cancel-booking-summary">
            <div class="cancel-booking-studio">${escapeHtml(booking.studio)}</div>
            <div class="cancel-booking-time">${formatDate(booking.date)} ${booking.startTime} - ${booking.endTime}</div>
            <div class="cancel-booking-user">摄影师：${escapeHtml(booking.photographer)}</div>
            ${note ? `<div class="cancel-booking-note">备注：${escapeHtml(note)}</div>` : ''}
        </div>
    `;

    openAccessibleModal('cancelBookingModal', '.btn-danger');
}

function closeCancelBookingConfirm() {
    closeAccessibleModal('cancelBookingModal');
    pendingCancelBookingId = null;
    pendingCancelStudioId = null;
}

async function confirmCancelBooking() {
    const bookingId = pendingCancelBookingId;
    const studioId = pendingCancelStudioId;
    if (!bookingId) return;
    const shouldRefreshStudioDetail = Boolean(studioId);

    await deleteBookingById(bookingId, {
        closeAfterDelete: !shouldRefreshStudioDetail,
        onDeleted: () => {
            closeCancelBookingConfirm();
            if (shouldRefreshStudioDetail) {
                showStudioDetail(studioId);
            }
        }
    });
}

function openAddBookingFromStudioDetail(studioId) {
    closeDetailModal();
    showAddBookingForm(studioId);
}

// 显示预约详情
function showBookingDetail(bookingId) {
    selectedBookingId = bookingId;
    const booking = allBookings.find(b => b.id === bookingId);

    if (!booking) return;

    const canManageBooking = canCancelBooking(booking);

    const detailHtml = `
        <div class="detail-item">
            <div class="detail-label">影棚</div>
            <div class="detail-value">${escapeHtml(booking.studio)}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">日期</div>
            <div class="detail-value">${formatDate(booking.date)}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">时间</div>
            <div class="detail-value">${booking.startTime} - ${booking.endTime}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">摄影师</div>
            <div class="detail-value">${escapeHtml(booking.photographer)}</div>
        </div>
        ${getBookingNote(booking) ? `
        <div class="detail-item">
            <div class="detail-label">备注</div>
            <div class="detail-value">${escapeHtml(getBookingNote(booking))}</div>
        </div>
        ` : ''}
    `;

    document.getElementById('bookingDetailContent').innerHTML = detailHtml;

    // 如果是自己的预约，显示删除按钮
    const actionsHtml = canManageBooking ? `
        <button onclick="editBooking()" class="btn btn-primary">修改时间</button>
        <button onclick="deleteBooking()" class="btn btn-danger">取消预约</button>
    ` : '';

    document.getElementById('detailActions').innerHTML = actionsHtml;

    openAccessibleModal('bookingDetailModal', '.close-btn');
}

function editBooking() {
    const booking = allBookings.find(item => item.id === selectedBookingId);
    if (!booking) return;
    if (!canCancelBooking(booking)) {
        showToast(getBookingStatus(booking) === 'completed' ? '已过期预约不能修改' : '只能修改自己的预约', 'error');
        return;
    }
    const bookingDate = getDateOnly(booking.date);
    if (!(isBookableDate(bookingDate, booking.studio) || bookingDate === getChinaDate(2))
        || (bookingDate === getChinaDate() && booking.endTime <= getChinaCurrentTime())) {
        showToast('已过期预约不能修改', 'error');
        return;
    }
    closeDetailModal();
    showAddBookingForm(booking.studio, booking);
}

// 关闭详情弹窗
function closeDetailModal() {
    closeAccessibleModal('bookingDetailModal');
    selectedBookingId = null;
}

// 删除预约
async function deleteBooking() {
    showCancelBookingConfirm(selectedBookingId);
}

async function deleteBookingById(bookingId, options = {}) {
    if (!bookingId) return false;
    if (bookingDeleteInFlight) return false;

    const { closeAfterDelete = true, onDeleted = null } = options;
    const booking = allBookings.find(item => item.id === bookingId);
    if (!booking) {
        showToast('预约不存在或已取消', 'error');
        return false;
    }
    if (!canCancelBooking(booking)) {
        showToast(getBookingStatus(booking) === 'completed' ? '已结束预约不能取消' : '只能取消自己的预约', 'error');
        return false;
    }

    const previousBookings = cloneBookings();

    try {
        bookingDeleteInFlight = true;
        removeLocalBooking(bookingId);
        if (typeof onDeleted === 'function') {
            onDeleted();
        }
        if (closeAfterDelete) {
            closeDetailModal();
        }
        showToast('正在同步取消...', 'success');

        if (isCloudMode()) {
            // 云端模式：调用 API
            const response = await apiFetch(`/api/bookings/${bookingId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `删除失败: ${response.status}`);
            }
        } else {
            // 本地模式：从数组中删除
            saveBookings();
        }

        showToast('预约已取消', 'success');
        if (isSimpleVideoRecipient()) await loadSimpleVideoTasks();
        return true;
    } catch (error) {
        restoreLocalBookings(previousBookings);
        console.error('取消预约失败:', error);
        showToast('取消预约失败，请重试', 'error');
        return false;
    } finally {
        bookingDeleteInFlight = false;
    }
}

// 渲染我的预约
function renderMyBookings() {
    const myBookingsList = document.getElementById('myBookingsList');
    const myBookings = allBookings.filter(b => b.photographer === currentUser);

    if (myBookings.length === 0) {
        myBookingsList.innerHTML = '<p class="empty-message">您还没有预约</p>';
    } else {
        myBookingsList.innerHTML = myBookings.map(booking => {
            const bookingId = inlineJsString(booking.id);
            return `
            <div class="booking-card my-booking" onclick="showBookingDetail(${bookingId})">
                <div class="booking-info">
                    <div>
                        <div class="booking-time">${booking.startTime} - ${booking.endTime}</div>
                        <div class="booking-date">${formatDate(booking.date)}</div>
                    </div>
                    <div class="booking-photographer">${escapeHtml(booking.studio)}</div>
                </div>
                ${getBookingNote(booking) ? `<div class="booking-note">${escapeHtml(getBookingNote(booking))}</div>` : ''}
            </div>
        `;
        }).join('');
    }
}

// 显示提示
// ============ 离线状态提示 ============
// PWA 断网时页面仍然打得开，用户需要知道自己看的是缓存数据而不是实时数据。
function getOfflineBanner() {
    let banner = document.getElementById('offlineBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'offlineBanner';
        banner.className = 'offline-banner hidden';
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
        banner.textContent = '当前处于离线状态，显示的是最后一次同步的数据';
        document.body.appendChild(banner);
    }
    return banner;
}

function updateOnlineStatus() {
    const offline = navigator.onLine === false;
    getOfflineBanner().classList.toggle('hidden', !offline);
}

window.addEventListener('offline', updateOnlineStatus);
window.addEventListener('online', () => {
    updateOnlineStatus();
    if (!autoRefreshInterval) return;
    showToast('网络已恢复，正在同步最新预约');
    loadBookings();
});

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // 读屏用户需要听到"预约成功 / 失败"这类反馈：
    // 错误用 alert（立即打断），其余用 status（等当前朗读结束）。
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// 点击弹窗外部关闭
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'addBookingModal') {
            closeAddBookingForm();
        } else if (e.target.id === 'bookingDetailModal') {
            closeDetailModal();
        } else if (e.target.id === 'cancelBookingModal') {
            closeCancelBookingConfirm();
        } else if (e.target.id === 'reminderModal') {
            closeReminderModal();
        } else if (e.target.id === 'changePasswordModal') {
            closeChangePasswordModal();
        }
    }
});

// ============ 新增功能：时间轴视图 ============

// 切换视图
async function switchView(view) {
    if (view === 'simple-video' && !isSimpleVideoRecipient()) {
        view = 'list';
    }
    currentView = view;
    if (window.innerWidth <= 768) closeUserMenu();

    // 更新桌面端按钮状态
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === view) {
            btn.classList.add('active');
        }
    });

    // 更新移动端底部导航状态
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
        if (nav.getAttribute('data-view') === view) {
            nav.classList.add('active');
        }
    });

    // 切换视图显示
    document.getElementById('listView').classList.add('hidden');
    document.getElementById('statsView').classList.add('hidden');
    const userMgmtView = document.getElementById('userManagementView');
    if (userMgmtView) userMgmtView.classList.add('hidden');
    const simpleVideoView = document.getElementById('simpleVideoView');
    if (simpleVideoView) simpleVideoView.classList.add('hidden');

    if (view === 'list') {
        document.getElementById('listView').classList.remove('hidden');
        renderBookings();
    } else if (view === 'stats') {
        document.getElementById('statsView').classList.remove('hidden');
        if (isCloudMode() && !bookingHistoryLoaded) {
            showStatsLoading();
            await loadBookings({ includeHistory: true });
            return;
        }
        initStatsView();
        renderStatsView();
    } else if (view === 'users') {
        if (userMgmtView) {
            userMgmtView.classList.remove('hidden');
            renderUserManagement();
        }
    } else if (view === 'simple-video') {
        if (simpleVideoView) {
            simpleVideoView.classList.remove('hidden');
            loadSimpleVideoTasks();
        }
    }
}

function showStatsLoading() {
    const totalBookings = document.getElementById('totalBookings');
    const totalHours = document.getElementById('totalHours');
    const totalPhotographers = document.getElementById('totalPhotographers');
    const tableBody = document.getElementById('statsTableBody');
    if (totalBookings) totalBookings.textContent = '...';
    if (totalHours) totalHours.textContent = '...';
    if (totalPhotographers) totalPhotographers.textContent = '...';
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="empty-message">正在加载统计数据...</td></tr>';
}

// 获取要显示的日期
function getDisplayDates() {
    switch (currentDateRange) {
        case 'yesterday':
            return [getChinaDate(-1)];
        case 'today':
            return [getChinaDate()];
        case 'tomorrow':
            return [getChinaDate(1)];
        case 'week':
            return Array.from({ length: 7 }, (_, i) => getChinaDate(i));
        case 'custom':
            return selectedDate ? [selectedDate] : [getChinaDate()];
        default:
            return [getChinaDate()];
    }
}

// 更新今日使用情况
function updateTodayUsage() {
    const todayUsageElement = document.getElementById('todayUsage');
    if (!todayUsageElement) return; // 如果元素不存在，直接返回

    const today = getChinaDate();
    const todayBookings = allBookings.filter(b =>
        b.photographer === currentUser && b.date === today
    );

    let totalHours = 0;
    todayBookings.forEach(booking => {
        const start = booking.startTime.split(':');
        const end = booking.endTime.split(':');
        const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
        const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
        const durationMinutes = endMinutes - startMinutes;
        totalHours += durationMinutes / 60;
    });

    todayUsageElement.textContent = `${totalHours.toFixed(1)}h`;
}

// 修改 showMainPage 函数以初始化新UI
const originalShowMainPage = showMainPage;
showMainPage = function() {
    originalShowMainPage();
    // 视图渲染已经在 loadBookings -> renderAllViews 里做过了，这里只负责初始化提醒
    initReminder();
};

// 移除底部的 loadBookings 覆盖，因为我们已经修改了原始函数
// ============ 提醒功能 ============

// 请求通知权限
// silent: 页面加载时的自动授权走静默模式——不弹 toast、不弹 alert、不发欢迎通知。
// 否则默认开启提醒后，用户每次打开页面都会被打扰一遍。
async function requestNotificationPermission({ silent = false } = {}) {
    debugLog('===== 请求通知权限 =====');

    if (!('Notification' in window)) {
        console.error('❌ 浏览器不支持通知功能');
        if (!silent) showToast('您的浏览器不支持通知功能', 'error');
        return false;
    }

    debugLog('当前权限状态:', Notification.permission);

    // 如果已经授权，直接返回true
    if (Notification.permission === 'granted') {
        debugLog('✅ 通知权限已授予');
        if (!silent) showToast('通知权限已开启', 'success');
        return true;
    }

    // 如果被拒绝，提示用户手动开启
    if (Notification.permission === 'denied') {
        console.warn('❌ 通知权限已被拒绝');
        if (!silent) {
            showToast('通知权限被拒绝，请在浏览器设置中允许', 'error');
            alert('通知权限已被拒绝\n\n手动开启方法：\n1. 点击地址栏左侧的锁图标\n2. 找到"通知"选项\n3. 改为"允许"\n4. 刷新页面');
        }
        return false;
    }

    // 权限状态为 default，请求授权
    try {
        debugLog('📝 正在请求通知权限...');
        const permission = await Notification.requestPermission();
        debugLog('用户选择:', permission);

        if (permission === 'granted') {
            debugLog('✅ 用户授予了通知权限');
            if (!silent) {
                showToast('通知权限已开启！', 'success');
                setTimeout(() => {
                    try {
                        new Notification('✅ 通知已开启', {
                            body: '现在可以接收预约提醒了！',
                            icon: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/2705.png',
                            silent: false
                        });
                    } catch (e) {
                        console.error('发送欢迎通知失败:', e);
                    }
                }, 500);
            }
            return true;
        }

        console.warn('❌ 用户拒绝了通知权限');
        if (!silent) showToast('您拒绝了通知权限', 'error');
        return false;
    } catch (error) {
        // Safari 等浏览器要求 requestPermission 必须由用户手势触发，
        // 自动请求会在这里失败——用户之后从菜单里手动打开即可。
        console.error('❌ 请求通知权限出错:', error);
        if (!silent) showToast('请求权限失败: ' + error.message, 'error');
        return false;
    }
}

// 开启/关闭提醒
async function toggleReminder() {
    const enableReminder = document.getElementById('enableReminder');

    if (enableReminder.checked) {
        // 尝试解锁音频
        unlockAudio();

        // 请求通知权限
        const granted = await requestNotificationPermission();

        if (!granted) {
            showToast('请允许浏览器通知权限以接收提醒', 'error');
            enableReminder.checked = false;
            return;
        }

        // 开始检查提醒
        startReminderCheck();
        showToast('提醒功能已开启', 'success');

        // 保存设置
        localStorage.setItem('reminderEnabled', 'true');
    } else {
        // 停止检查提醒
        stopReminderCheck();
        showToast('提醒功能已关闭', 'success');
        localStorage.setItem('reminderEnabled', 'false');
    }
}

// 开始检查提醒
function startReminderCheck() {
    // 立即检查一次
    checkUpcomingBookings();

    // 每30秒检查一次
    if (reminderInterval) {
        clearInterval(reminderInterval);
    }
    reminderInterval = setInterval(checkUpcomingBookings, 30000);
}

// 停止检查提醒
function stopReminderCheck() {
    if (reminderInterval) {
        clearInterval(reminderInterval);
        reminderInterval = null;
    }
    // 隐藏提醒条
    document.getElementById('reminderBar').classList.add('hidden');
}

// 检查即将开始的预约
function checkUpcomingBookings() {
    if (isSimpleVideoRecipient()) {
        loadSimpleVideoTasks().then(() => {
            const notified = JSON.parse(localStorage.getItem('simpleVideoNotified') || '{}');
            simpleVideoTasks.forEach(task => {
                const key = `${task.id}:${task.date}`;
                if (notified[key]) return;
                notified[key] = Date.now();
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    new Notification('简易视频待办', {
                        body: `${task.photographer} ${formatShortDate(task.simpleVideoTargetDate)}需要预约无影棚`
                    });
                }
            });
            localStorage.setItem('simpleVideoNotified', JSON.stringify(notified));
        });
    }
    const todayStr = getChinaDate();
    const currentMinutes = timeToMinutes(getChinaCurrentTime());

    // 获取今天我的预约
    const myTodayBookings = allBookings.filter(b =>
        b.photographer === currentUser && b.date === todayStr
    );

    let reminderText = '';
    let shouldNotify = false;
    let notifyTitle = '';
    let notifyBody = '';
    let notifyBooking = null;

    for (const booking of myTodayBookings) {
        const startTime = booking.startTime.split(':');
        const startMinutes = parseInt(startTime[0]) * 60 + parseInt(startTime[1]);
        const endTime = booking.endTime.split(':');
        const endMinutes = parseInt(endTime[0]) * 60 + parseInt(endTime[1]);

        const minutesUntilStart = startMinutes - currentMinutes;
        const minutesUntilEnd = endMinutes - currentMinutes;

        // 正在进行中的预约
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
            const minutesLeft = minutesUntilEnd;
            reminderText = `您在${booking.studio}的预约正在进行中，还剩${minutesLeft}分钟`;

            // 如果是刚开始（前1分钟内），发送通知
            if (minutesUntilStart >= -1 && minutesUntilStart <= 0) {
                const notifyKey = `${booking.id}_start`;
                if (!notifiedBookings.has(notifyKey)) {
                    shouldNotify = true;
                    notifyTitle = '预约开始了！';
                    notifyBody = `您在${booking.studio}的预约现在开始了`;
                    notifyBooking = booking;
                    notifiedBookings.add(notifyKey);
                }
            }
            break;
        }

        // 即将开始的预约（5分钟内）
        if (minutesUntilStart > 0 && minutesUntilStart <= 5) {
            reminderText = `您在${booking.studio}的预约将在${minutesUntilStart}分钟后开始 (${booking.startTime}-${booking.endTime})`;

            // 发送5分钟提醒通知
            const notifyKey = `${booking.id}_5min`;
            if (!notifiedBookings.has(notifyKey)) {
                shouldNotify = true;
                notifyTitle = '预约即将开始！';
                notifyBody = `您在${booking.studio}的预约将在${minutesUntilStart}分钟后开始`;
                notifyBooking = booking;
                notifiedBookings.add(notifyKey);
            }
            break;
        }
    }

    // 更新页面提醒条
    if (reminderText) {
        showReminderBar(reminderText);
    } else {
        document.getElementById('reminderBar').classList.add('hidden');
    }

    // 发送浏览器通知
    if (shouldNotify && notifyBooking) {
        sendNotification(notifyTitle, notifyBody);
        playNotificationSound();

        // 显示弹窗提醒
        showReminderModal(notifyTitle, notifyBody, notifyBooking);
    }
}

// 显示提醒条
function showReminderBar(text) {
    const reminderBar = document.getElementById('reminderBar');
    const reminderText = document.getElementById('reminderText');

    reminderText.textContent = text;
    reminderBar.classList.remove('hidden');
}

// 关闭提醒条
function closeReminder() {
    document.getElementById('reminderBar').classList.add('hidden');
}

// 发送浏览器通知
function sendNotification(title, body) {
    debugLog('===== 发送通知 =====');
    debugLog('标题:', title);
    debugLog('内容:', body);

    // 检查浏览器支持
    if (!('Notification' in window)) {
        console.error('❌ 浏览器不支持通知');
        return;
    }

    // 检查权限
    const permission = Notification.permission;
    debugLog('当前权限:', permission);

    if (permission === 'granted') {
        try {
            debugLog('📤 正在创建通知...');
            const notification = new Notification(title, {
                body: body,
                icon: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f4f7.png',
                badge: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f514.png',
                tag: 'booking-' + Date.now(),
                requireInteraction: false,
                silent: true // 不使用系统声音，因为我们有自定义声音
            });

            notification.onshow = function() {
                debugLog('✅ 通知已显示');
            };

            notification.onclick = function() {
                debugLog('👆 通知被点击');
                window.focus();
                notification.close();
            };

            notification.onerror = function(e) {
                console.error('❌ 通知显示错误:', e);
            };

            debugLog('✅ 通知创建成功');
        } catch (error) {
            console.error('❌ 创建通知失败:', error);
        }
    } else if (permission === 'denied') {
        console.warn('⚠️ 通知权限被拒绝');
        showToast('通知权限被拒绝，无法发送提醒', 'error');
    } else {
        console.warn('⚠️ 通知权限未授予');
        showToast('请先开启"开启提醒通知"开关', 'error');
    }
}

// 解锁音频上下文（用于移动端）
function unlockAudio() {
    if (!globalAudioContext) {
        globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (globalAudioContext.state === 'suspended') {
        globalAudioContext.resume().then(() => {
            debugLog('✅ 音频上下文已解锁');
        });
    }
}

// 播放通知声音
function playNotificationSound() {
    const soundCheckbox = document.getElementById('enableSound');
    if (!soundCheckbox || !soundCheckbox.checked) {
        return;
    }

    try {
        // 如果没有全局上下文或已关闭，创建新的
        if (!globalAudioContext) {
            globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const audioContext = globalAudioContext;

        // 创建两个音符的提示音
        const playBeep = (frequency, startTime, duration) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
        };

        const now = audioContext.currentTime;
        playBeep(800, now, 0.1);
        playBeep(1000, now + 0.15, 0.15);

    } catch (error) {
        debugLog('无法播放提示音:', error);
    }
}

// 初始化提醒功能
function initReminder() {
    // 没有存过偏好时默认开启：所有人都需要预约提醒，
    // 不该让他们先去菜单里翻出来打开。只有显式关掉过才保持关闭。
    const stored = localStorage.getItem('reminderEnabled');
    const enabled = stored === null ? true : stored === 'true';

    const checkbox = document.getElementById('enableReminder');
    if (checkbox) checkbox.checked = enabled;
    if (!enabled) return;

    requestNotificationPermission({ silent: true }).then(granted => {
        if (granted) {
            startReminderCheck();
            localStorage.setItem('reminderEnabled', 'true');
            return;
        }
        // 权限没拿到就先取消勾选，但不写 localStorage：
        // 可能只是这次没授权（或浏览器要求手势），下次打开还应该再试一次，
        // 而不是被永久记成"用户关掉了提醒"。
        if (checkbox) checkbox.checked = false;
    });
}

// 显示提醒弹窗
function showReminderModal(title, message, booking) {
    const modal = document.getElementById('reminderModal');
    const modalTitle = document.getElementById('reminderModalTitle');
    const modalMessage = document.getElementById('reminderModalMessage');
    const modalTime = document.getElementById('reminderModalTime');

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalTime.innerHTML = `
        <div style="margin-bottom: 8px;">${booking.studio}</div>
        <div style="font-size: 24px; color: #667eea;">${booking.startTime} - ${booking.endTime}</div>
        ${booking.note ? `<div style="font-size: 14px; color: #6b7280; margin-top: 8px;">${booking.note}</div>` : ''}
    `;

    openAccessibleModal('reminderModal', '.btn-primary');

    // 5秒后自动关闭（可选）
    // setTimeout(() => {
    //     closeReminderModal();
    // }, 5000);
}

// 关闭提醒弹窗
function closeReminderModal() {
    closeAccessibleModal('reminderModal');
}

// 测试提醒功能
function testReminder() {
    debugLog('===== 测试提醒功能 =====');

    // 强制尝试解锁音频
    unlockAudio();

    // 检查权限
    if (!('Notification' in window)) {
        alert('❌ 您的浏览器不支持通知功能');
        return;
    }

    const permission = Notification.permission;
    
    if (permission !== 'granted') {
        alert('⚠️ 通知权限未开启！\n\n状态: ' + permission + '\n请先点击上方的"开启提醒通知"开关。');
        return;
    }

    // 检查音频状态
    let audioStatus = '未知';
    if (globalAudioContext) {
        audioStatus = globalAudioContext.state;
    } else {
        audioStatus = '未初始化';
    }

    showToast('正在测试...', 'success');

    // 1. 播放声音
    debugLog('1️⃣ 播放提示音 (状态: ' + audioStatus + ')');
    playNotificationSound();

    // 2. 发送系统通知
    debugLog('2️⃣ 发送系统通知');
    sendNotification('🔔 测试提醒成功', '声音和通知功能正常！\n(请保持网页在前台运行)');

    // 3. 显示页面弹窗
    debugLog('3️⃣ 显示页面弹窗');
    setTimeout(() => {
        const testBooking = {
            studio: '测试影棚',
            startTime: '14:00',
            endTime: '15:00',
            note: '这是一个测试预约，用于验证提醒功能是否正常。'
        };
        showReminderModal('🔔 提醒功能正常', '如果您听到了声音并看到了这条消息，说明设置成功！', testBooking);
    }, 500);
}

// ============ 统计功能 ============

// 初始化统计视图
function initStatsView() {
    // 获取所有唯一的月份
    const months = new Set();
    allBookings.forEach(booking => {
        const yearMonth = booking.date.substring(0, 7); // 提取 YYYY-MM
        months.add(yearMonth);
    });

    // 按时间倒序排列
    const sortedMonths = Array.from(months).sort().reverse();

    // 填充月份下拉框
    const monthSelect = document.getElementById('statsMonth');
    monthSelect.innerHTML = '<option value="all">所有时间</option>';

    sortedMonths.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = month;
        monthSelect.appendChild(option);
    });
}

// 渲染统计视图
// 注意：统计功能显示所有历史数据（包括过去的预约），用于数据分析
function renderStatsView() {
    debugLog('=== 渲染统计视图 ===');
    debugLog('总预约数:', allBookings.length);

    const selectedMonth = document.getElementById('statsMonth');
    const selectedStudio = document.getElementById('statsStudio');

    // 检查元素是否存在
    if (!selectedMonth || !selectedStudio) {
        console.error('统计视图元素未找到');
        return;
    }

    const monthValue = selectedMonth.value;
    const studioValue = selectedStudio.value;

    debugLog('选择的月份:', monthValue);
    debugLog('选择的影棚:', studioValue);

    // 根据选择过滤预约（使用 allBookings，包含所有历史数据）
    let filteredBookings = [...allBookings];

    if (monthValue !== 'all') {
        filteredBookings = filteredBookings.filter(b => b.date.startsWith(monthValue));
    }

    if (studioValue !== 'all') {
        filteredBookings = filteredBookings.filter(b => b.studio === studioValue);
    }

    debugLog('过滤后的预约数:', filteredBookings.length);

    // 按摄影师分组统计
    const photographerStats = {};

    filteredBookings.forEach(booking => {
        if (!photographerStats[booking.photographer]) {
            photographerStats[booking.photographer] = {
                count: 0,
                totalMinutes: 0
            };
        }

        // 计算预约时长（分钟）
        const startTime = booking.startTime.split(':');
        const endTime = booking.endTime.split(':');
        const startMinutes = parseInt(startTime[0]) * 60 + parseInt(startTime[1]);
        const endMinutes = parseInt(endTime[0]) * 60 + parseInt(endTime[1]);
        const durationMinutes = endMinutes - startMinutes;

        photographerStats[booking.photographer].count += 1;
        photographerStats[booking.photographer].totalMinutes += durationMinutes;
    });

    // 转换为数组并排序
    const statsArray = Object.entries(photographerStats).map(([name, stats]) => ({
        photographer: name,
        count: stats.count,
        totalHours: stats.totalMinutes / 60,
        avgHours: stats.totalMinutes / 60 / stats.count
    }));

    // 按总时长降序排列
    statsArray.sort((a, b) => b.totalHours - a.totalHours);

    // 计算总时长用于百分比
    const totalMinutes = statsArray.reduce((sum, stat) => sum + stat.totalHours * 60, 0);
    const totalHours = totalMinutes / 60;

    // 更新汇总卡片
    document.getElementById('totalBookings').textContent = filteredBookings.length;
    document.getElementById('totalHours').textContent = `${totalHours.toFixed(1)}h`;
    document.getElementById('totalPhotographers').textContent = statsArray.length;

    // 更新统计表格
    const tableBody = document.getElementById('statsTableBody');

    if (statsArray.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-message">暂无数据</td></tr>';
        debugLog('统计数据为空');
        return;
    }

    debugLog('生成统计表格，摄影师数量:', statsArray.length);

    tableBody.innerHTML = statsArray.map((stat, index) => {
        const rank = index + 1;
        const percentage = totalHours > 0 ? (stat.totalHours / totalHours * 100) : 0;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';

        return `
            <tr class="${rankClass}">
                <td data-label="排名">${rank}</td>
                <td data-label="摄影师">${escapeHtml(stat.photographer)}</td>
                <td data-label="预约次数">${stat.count}</td>
                <td data-label="总时长">${stat.totalHours.toFixed(1)}h</td>
                <td data-label="平均时长">${stat.avgHours.toFixed(1)}h</td>
                <td data-label="占比">${percentage.toFixed(1)}%</td>
            </tr>
        `;
    }).join('');
}



