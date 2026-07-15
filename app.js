// 全局变量
let currentUser = null;
let allBookings = [];
let selectedBookingId = null;
let currentView = 'list'; // 'list' or 'stats'
let currentDateRange = 'today'; // 'today', 'tomorrow', 'week'
let selectedDate = null;
let pendingCancelBookingId = null;
let pendingCancelStudioId = null;
let reminderInterval = null;
let notifiedBookings = new Set(); // 记录已通知的预约ID
let soundEnabled = true;
let globalAudioContext = null; // 全局 AudioContext
let authToken = null;
let editingBookingId = null;

// ============ 影棚配置 ============
// 所有影棚入口、下拉框、统计筛选和时间轴都从这里生成。
const STUDIO_GROUPS = [
    {
        key: 'large',
        title: '7F 大棚区域',
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
            { id: '小无影棚1', title: '无影棚1', location: '小棚区 1' },
            { id: '小无影棚2', title: '无影棚2', location: '小棚区 2' },
            { id: '小无影棚3', title: '无影棚3', location: '小棚区 3' },
            { id: '小无影棚4', title: '无影棚4', location: '小棚区 4' }
        ]
    },
    {
        key: 'sixth-floor',
        title: '6F',
        subtitle: '跨楼层备用棚',
        optionLabel: '6F',
        cardClass: 'studio-section-sixth',
        buttonClass: 'btn-primary',
        studios: [
            { id: '6F无影棚', title: '6F无影棚', location: '6F' }
        ]
    },
];

function getAllStudios() {
    return STUDIO_GROUPS.flatMap(group => group.studios.map(studio => ({
        ...studio,
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

    container.innerHTML = `
        <div class="studio-map">
            ${STUDIO_GROUPS.map(group => `
                <section class="studio-map-zone studio-map-zone-${group.key}">
                    <div class="studio-map-zone-header">
                        <h3>${escapeHtml(group.title)}</h3>
                    </div>
                    <div class="studio-map-cards">
                        ${group.studios.map(studio => `
                            <div
                                class="studio-section studio-overview-card ${group.cardClass}"
                                data-studio-id="${escapeHtml(studio.id)}"
                                data-studio-group="${group.key}"
                                onclick="showAddBookingForm('${escapeHtml(studio.id)}')"
                                role="button"
                                tabindex="0"
                                onkeydown="handleStudioCardKeydown(event, '${escapeHtml(studio.id)}')"
                            >
                                <div class="studio-section-header">
                                    <div>
                                        <h2>
                                            ${escapeHtml(studio.title)}
                                            ${group.key === 'large' && studio.location ? `<small class="studio-card-location">（${escapeHtml(studio.location)}）</small>` : ''}
                                        </h2>
                                    </div>
                                </div>
                                <div id="${getStudioListId(studio.id)}" class="studio-summary">
                                    <p class="empty-message">暂无预约</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `).join('')}
        </div>
    `;
}

function renderStudioOptions(selectId, includeAll = false) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const allOption = includeAll ? '<option value="all">所有影棚</option>' : '';
    select.innerHTML = allOption + STUDIO_GROUPS.map(group => `
        <optgroup label="${group.optionLabel}">
            ${group.studios.map(studio => `<option value="${escapeHtml(studio.id)}">${studio.id}</option>`).join('')}
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

const BOOKING_START_TIME = '08:30';
const BOOKING_END_TIME = '18:30';
const BOOKING_INTERVAL_MINUTES = 15;
const BOOKABLE_PERIODS = [
    { start: '08:30', end: '12:30' },
    { start: '14:00', end: '18:30' }
];

function timeToMinutes(time) {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
}

function minutesToTime(minutes) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getChinaDate(offsetDays = 0) {
    const date = new Date(Date.now() + offsetDays * 86400000);
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

function getChinaCurrentTime() {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date());
}

function getBookablePeriod(time) {
    return BOOKABLE_PERIODS.find(period => time >= period.start && time <= period.end) || null;
}

function isValidBookingRange(startTime, endTime) {
    const period = getBookablePeriod(startTime);
    if (!period || getBookablePeriod(endTime) !== period) return false;
    return minutesToTime(timeToMinutes(startTime)) === startTime
        && minutesToTime(timeToMinutes(endTime)) === endTime
        && (timeToMinutes(startTime) - timeToMinutes(period.start)) % BOOKING_INTERVAL_MINUTES === 0
        && (timeToMinutes(endTime) - timeToMinutes(period.start)) % BOOKING_INTERVAL_MINUTES === 0
        && startTime < endTime;
}

function getTimeOptions(startTime = BOOKING_START_TIME, endTime = BOOKING_END_TIME, step = BOOKING_INTERVAL_MINUTES) {
    const options = [];
    for (let minutes = timeToMinutes(startTime); minutes <= timeToMinutes(endTime); minutes += step) {
        options.push(minutesToTime(minutes));
    }
    return options;
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
        currentUser = null;
        stopAutoRefresh();
        document.getElementById('loginPage')?.classList.remove('hidden');
        document.getElementById('mainPage')?.classList.add('hidden');
    }
    return response;
}

// 自动刷新间隔（云端模式下每30秒刷新一次）
let autoRefreshInterval = null;

function startAutoRefresh() {
    if (isCloudMode() && !autoRefreshInterval) {
        autoRefreshInterval = setInterval(async () => {
            console.log('🔄 自动刷新数据...');
            await loadBookings();
        }, 30000); // 30秒刷新一次
    }
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// ============ 移动端侧边栏控制 ============

// 打开/关闭侧边栏
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar && overlay) {
        const isActive = sidebar.classList.contains('active');

        if (isActive) {
            // 关闭侧边栏
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            if (window.innerWidth <= 768) {
                sidebar.style.left = '-280px';
            }
        } else {
            // 打开侧边栏
            sidebar.classList.add('active');
            overlay.classList.add('active');
            if (window.innerWidth <= 768) {
                sidebar.style.left = '0';
            }
        }
    }
}

// 关闭侧边栏
function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar && overlay) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        if (window.innerWidth <= 768) {
            sidebar.style.left = '-280px';
        }
    }
}

// 初始化应用
window.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ 应用初始化成功（使用 localStorage）');

    // 初始化移动端侧边栏（确保页面加载时是隐藏的）
    initMobileSidebar();

    // 监听任意点击以解锁音频（iOS必须）
    document.addEventListener('click', unlockAudio, { once: false });
    document.addEventListener('touchstart', unlockAudio, { once: false });

    // 云端模式必须通过服务端会话恢复登录，本地预览保留原来的本地模式。
    authToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');
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
                localStorage.setItem('currentUser', currentUser);
                showMainPage();
            } else {
                authToken = null;
                localStorage.removeItem('authToken');
            }
        } catch (error) {
            console.error('恢复登录失败:', error);
        }
    }

    // 设置今天的日期为默认值
    const today = getChinaDate();
    document.getElementById('bookingDate').value = today;

    // 监听窗口大小变化，确保移动端侧边栏正确显示
    window.addEventListener('resize', () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && window.innerWidth <= 768) {
            if (!sidebar.classList.contains('active')) {
                sidebar.style.left = '-280px';
            }
        } else if (sidebar && window.innerWidth > 768) {
            // 桌面端重置内联样式
            sidebar.style.position = '';
            sidebar.style.left = '';
            sidebar.style.top = '';
            sidebar.style.width = '';
            sidebar.style.zIndex = '';
        }
    });
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
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', currentUser);

            if (rememberMe) {
            localStorage.setItem('savedUsername', name);
            localStorage.setItem('rememberMe', 'true');
            } else {
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

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
}

// ============ 修改密码功能 ============

// 显示修改密码弹窗
function showChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.remove('hidden');
    // 清空输入框
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
}

// 关闭修改密码弹窗
function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.add('hidden');
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
        if (newPassword.length < 4 || newPassword !== confirmPassword) {
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

    if (newPassword.length < 4) {
        showToast('新密码至少需要4位', 'error');
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
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        stopAutoRefresh(); // 停止自动刷新
        document.getElementById('loginPage').classList.remove('hidden');
        document.getElementById('mainPage').classList.add('hidden');
        document.getElementById('photographerName').value = '';
    }
}

// 显示主页面
function showMainPage() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('mainPage').classList.remove('hidden');
    document.getElementById('currentUser').textContent = currentUser;
    initStudioUI();

    // admin 用户显示用户管理入口
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = currentUser === 'admin' ? '' : 'none';
    });

    // 确保移动端侧边栏初始状态为隐藏
    initMobileSidebar();

    // 加载预约数据
    loadBookings();

    // 云端模式下启动自动刷新
    startAutoRefresh();
}

// 初始化移动端侧边栏状态
function initMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar && overlay) {
        // 确保侧边栏是隐藏的
        sidebar.classList.remove('active');
        overlay.classList.remove('active');

        // 对于移动端，强制设置样式
        if (window.innerWidth <= 768) {
            sidebar.style.position = 'fixed';
            sidebar.style.left = '-280px';
            sidebar.style.top = '50px';
            sidebar.style.width = '260px';
            sidebar.style.zIndex = '999';
        }
    }
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
            console.log('✅ 已将旧影棚名称迁移到新版影棚配置');
        } catch (error) {
            console.error('迁移影棚名称保存失败:', error);
        }
    }
}

async function loadBookings() {
    console.log('开始加载预约数据...');

    if (isCloudMode()) {
        // 云端模式：从 API 加载
        try {
            const response = await apiFetch('/api/bookings');
            if (!response.ok) {
                throw new Error(`加载失败: ${response.status}`);
            }
            allBookings = await response.json();

            // 标准化字段名：后端使用 notes，前端使用 note
            allBookings = allBookings.map(booking => ({
                ...booking,
                studio: normalizeStudioName(booking.studio),
                note: booking.notes || booking.note || ''
            }));

            sortBookings();
            renderAllViews();
            console.log('✅ 从云端加载了', allBookings.length, '条预约');
        } catch (error) {
            console.error('从云端加载预约失败:', error);
            showToast('加载数据失败，请检查网络', 'error');
            allBookings = [];
        }
    } else {
        // 本地模式：从 localStorage 加载
        try {
            const stored = localStorage.getItem('bookings');
            allBookings = stored ? JSON.parse(stored) : [];
            migrateStudioNames();
            sortBookings();
            renderAllViews();
            console.log('✅ 从本地加载了', allBookings.length, '条预约');
        } catch (error) {
            console.error('加载预约失败:', error);
            showToast('加载数据失败', 'error');
            allBookings = [];
        }
    }
}

// 保存预约数据到 localStorage（仅本地模式使用）
function saveBookings() {
    if (isCloudMode()) {
        // 云端模式不需要手动保存，API 会自动处理
        return;
    }
    try {
        localStorage.setItem('bookings', JSON.stringify(allBookings));
        console.log('✅ 已保存', allBookings.length, '条预约到 localStorage');
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

// 统一渲染所有视图
function renderAllViews() {
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
        const fullyBooked = isStudioFullyBooked(studio.id, displayDates);
        if (studioCard) {
            studioCard.classList.toggle('studio-fully-booked', fullyBooked);
            studioCard.title = fullyBooked ? '当前日期已约满' : '';
        }

        studioSummary.innerHTML = createStudioSummary(studio, studioBookings);
    });
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

function getBookableEndDate() {
    return getChinaDate(1);
}

function isBookableDate(date) {
    return date >= getBookableStartDate() && date <= getBookableEndDate();
}

function getDefaultBookingDate() {
    const displayDate = getDisplayDates()[0];
    return isBookableDate(displayDate) ? displayDate : getBookableStartDate();
}

function hasAvailableBookingSlot(studioId, date) {
    if (!isBookableDate(date)) return false;

    const today = getBookableStartDate();
    const currentTime = getChinaCurrentTime();
    const existingBookings = getStudioBookingsForDates(studioId, [date]);
    const startTimes = BOOKABLE_PERIODS.flatMap(period =>
        getTimeOptions(period.start, period.end).slice(0, -1)
    );

    return startTimes.some(startTime => {
        if (date === today && startTime < currentTime) return false;

        const endTime = minutesToTime(timeToMinutes(startTime) + BOOKING_INTERVAL_MINUTES);
        return !existingBookings.some(booking =>
            !(endTime <= booking.startTime || startTime >= booking.endTime)
        );
    });
}

function isStudioFullyBooked(studioId, dates) {
    const bookableDates = dates.filter(isBookableDate);
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
                onclick="${isCancellable ? `openSummaryCancel(event, ${bookingId})` : 'event.stopPropagation()'}"
                ${isCancellable ? `role="button" tabindex="0" onkeydown="handleSummaryBookingKeydown(event, ${bookingId})"` : ''}
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

function openSummaryCancel(event, bookingId) {
    event.stopPropagation();
    showCancelBookingConfirm(bookingId);
}

function handleSummaryBookingKeydown(event, bookingId) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        showCancelBookingConfirm(bookingId);
    }
}

function getAvailabilitySlotState(time, selectedDate, existingBookings) {
    const today = getChinaDate();
    const currentTime = getChinaCurrentTime();
    const isPeriodEnd = BOOKABLE_PERIODS.some(period => period.end === time);

    const booking = existingBookings.find(item =>
        time >= item.startTime && (time < item.endTime || (isPeriodEnd && time === item.endTime))
    );
    if (booking) {
        return {
            type: 'booked',
            label: `${booking.startTime}-${booking.endTime} ${booking.photographer}`,
            booking
        };
    }

    if (selectedDate === today && time < currentTime) {
        return { type: 'past', label: '已过' };
    }

    return { type: 'free', label: '可约' };
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
        .filter(booking => booking.studio === studio && getDateOnly(booking.date) === selectedDate)
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
        const canSelect = state.type === 'free' || state.type === 'closing';
        return `
            <button
                type="button"
                class="availability-slot availability-${state.type}${selectedClass}"
                ${canSelect ? `onclick="selectAvailabilityTime('${time}')"` : 'disabled'}
                title="${escapeHtml(state.label)}"
            >
                <span>${time}</span>
            </button>
        `;
    };

    const morningTimes = times.filter(time => time >= '08:30' && time <= '12:30');
    const afternoonTimes = times.filter(time => time >= '14:00' && time <= '18:30');
    timeline.innerHTML = `
        <section class="availability-period">
            <div class="availability-period-title">上午</div>
            <div class="availability-period-grid">
                ${morningTimes.map(renderAvailabilitySlot).join('')}
            </div>
        </section>
        <section class="availability-period">
            <div class="availability-period-title">下午</div>
            <div class="availability-period-grid">
                ${afternoonTimes.map(renderAvailabilitySlot).join('')}
            </div>
        </section>
    `;

    if (existingBookings.length === 0) {
        bookingsList.innerHTML = '<p class="availability-empty">当天还没有预约，整段时间都比较空。</p>';
        return;
    }

    bookingsList.innerHTML = existingBookings.map(booking => `
        <div class="availability-booking-item">
            <strong>${booking.startTime}-${booking.endTime}</strong>
            <span>${escapeHtml(booking.photographer)}</span>
            ${getBookingNote(booking) ? `<em>${escapeHtml(getBookingNote(booking))}</em>` : ''}
        </div>
    `).join('');
}

function selectAvailabilityTime(time) {
    const startTimeSelect = document.getElementById('startTime');
    const endTimeSelect = document.getElementById('endTime');
    const studio = document.getElementById('studioSelect').value;
    const date = document.getElementById('bookingDate').value;
    const existingBookings = allBookings
        .filter(booking => booking.studio === studio && getDateOnly(booking.date) === date)
        .sort(compareBookingsByTime);

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
function showAddBookingForm(defaultStudio, bookingToEdit = null) {
    if (currentUser && currentUser.startsWith('游客')) {
        alert('游客模式不能预约，请登录后操作。');
        return;
    }
    editingBookingId = bookingToEdit?.id || null;
    document.getElementById('bookingModalTitle').textContent = editingBookingId ? '修改预约时间' : '预约';
    document.getElementById('bookingSubmitButton').textContent = editingBookingId ? '保存修改' : '确认预约';
    document.getElementById('addBookingModal').classList.remove('hidden');

    // 重置表单
    const studioSelect = document.getElementById('studioSelect');
    if (defaultStudio) {
        studioSelect.value = normalizeStudioName(defaultStudio);
    } else {
        studioSelect.value = getDefaultStudioId();
    }

    // 最多提前一天预约：今天和明天可选，后天及以后不可选。
    const minDate = getBookableStartDate();
    const maxDate = getBookableEndDate();
    const defaultDate = bookingToEdit ? getDateOnly(bookingToEdit.date) : getDefaultBookingDate();
    const dateInput = document.getElementById('bookingDate');
    dateInput.min = minDate;
    dateInput.max = maxDate;
    dateInput.value = defaultDate;
    document.getElementById('startTime').value = bookingToEdit?.startTime || '';
    document.getElementById('endTime').value = bookingToEdit?.endTime || '';
    document.getElementById('bookingNote').value = bookingToEdit ? getBookingNote(bookingToEdit) : '';

    const startTimeSelect = document.getElementById('startTime');
    const endTimeSelect = document.getElementById('endTime');
    renderTimeSelectOptions();

    startTimeSelect.value = bookingToEdit?.startTime || '';
    endTimeSelect.value = bookingToEdit?.endTime || '';

    // 根据选择的日期和当前时间，禁用已过去的开始时间
    function updateStartTimeOptions() {
        if (!isBookableDate(dateInput.value)) {
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
    dateInput.onchange = updateStartTimeOptions;
    document.getElementById('studioSelect').onchange = updateStartTimeOptions;

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
}

// 关闭新建预约表单
function closeAddBookingForm() {
    const modal = document.getElementById('addBookingModal');
    if (modal) {
        modal.classList.add('hidden');
        editingBookingId = null;
        document.getElementById('bookingModalTitle').textContent = '预约';
        document.getElementById('bookingSubmitButton').textContent = '确认预约';
        console.log('弹窗已关闭');
    }
}

// 添加预约
async function addBooking() {
    console.log('=== addBooking 函数被调用 ===');

    const studio = document.getElementById('studioSelect').value;
    const date = document.getElementById('bookingDate').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const note = document.getElementById('bookingNote').value.trim();

    console.log('提交预约:', { studio, date, startTime, endTime, note });

    // 验证
    if (!date || !startTime || !endTime) {
        showToast('请填写完整的预约信息', 'error');
        return;
    }

    if (!isBookableDate(date)) {
        showToast('只能预约今天或明天的无影棚', 'error');
        return;
    }

    if (!getStudioById(studio)) {
        showToast('请选择有效的影棚', 'error');
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

    // 检查时间冲突
    const hasConflict = allBookings.some(booking => {
        if (booking.id === editingBookingId) return false;
        if (booking.studio !== studio || getDateOnly(booking.date) !== date) {
            return false;
        }

        // 检查时间段是否重叠
        return !(endTime <= booking.startTime || startTime >= booking.endTime);
    });

    if (hasConflict) {
        console.log('检测到时间冲突');
        showToast('该时间段已被预约，请选择其他时间', 'error');
        return;
    }

    // 创建新预约对象
    const originalBooking = editingBookingId
        ? allBookings.find(booking => booking.id === editingBookingId)
        : null;
    const isEditing = Boolean(editingBookingId);
    const newBooking = {
        id: editingBookingId || String(Date.now()), // 修改时保留原预约 ID
        studio: studio,
        date: date,
        startTime: startTime,
        endTime: endTime,
        photographer: originalBooking?.photographer || currentUser,
        contact: originalBooking?.contact || currentUser,
        note: note,
        notes: note, // 后端字段名是 notes
        createdAt: new Date().toISOString() // 使用 ISO 格式
    };

    try {
        if (isCloudMode()) {
            // 云端模式：调用 API
            console.log('正在保存预约到云端...');
            const response = await apiFetch(editingBookingId ? `/api/bookings/${editingBookingId}` : '/api/bookings', {
                method: editingBookingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newBooking)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `服务器错误: ${response.status}`);
            }

            // 重新加载数据以获取最新状态
            await loadBookings();
        } else {
            // 本地模式：保存到 localStorage
            console.log('正在保存预约到 localStorage...');
            if (editingBookingId) {
                const index = allBookings.findIndex(booking => booking.id === editingBookingId);
                if (index >= 0) allBookings[index] = newBooking;
            } else {
                allBookings.push(newBooking);
            }
            saveBookings();
            sortBookings();
            renderAllViews();
        }

        console.log('✅ 预约保存成功');
        showToast(isEditing ? '预约时间已修改' : '预约成功', 'success');
        closeAddBookingForm();

    } catch (error) {
        console.error('❌ 预约失败:', error);
        showToast('预约失败：' + error.message, 'error');
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
        <button onclick="closeDetailModal()" class="btn btn-secondary">关闭</button>
    `;

    document.getElementById('bookingDetailModal').classList.remove('hidden');
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
    return Boolean(booking && currentUser && (booking.photographer === currentUser || currentUser === 'admin'));
}

async function cancelBookingFromStudioDetail(event, bookingId, studioId) {
    event.stopPropagation();
    showCancelBookingConfirm(bookingId, studioId);
}

function showCancelBookingConfirm(bookingId, studioId = '') {
    const booking = allBookings.find(item => item.id === bookingId);
    if (!booking) return;
    if (!canCancelBooking(booking)) {
        showToast('只能取消自己的预约', 'error');
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

    document.getElementById('cancelBookingModal').classList.remove('hidden');
}

function closeCancelBookingConfirm() {
    document.getElementById('cancelBookingModal').classList.add('hidden');
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

    const isMyBooking = canCancelBooking(booking);

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
    const actionsHtml = isMyBooking ? `
        <button onclick="editBooking()" class="btn btn-primary">修改时间</button>
        <button onclick="deleteBooking()" class="btn btn-danger">取消预约</button>
        <button onclick="closeDetailModal()" class="btn btn-secondary">关闭</button>
    ` : `
        <button onclick="closeDetailModal()" class="btn btn-secondary">关闭</button>
    `;

    document.getElementById('detailActions').innerHTML = actionsHtml;

    document.getElementById('bookingDetailModal').classList.remove('hidden');
}

function editBooking() {
    const booking = allBookings.find(item => item.id === selectedBookingId);
    if (!booking) return;
    if (!canCancelBooking(booking)) {
        showToast('只能修改自己的预约', 'error');
        return;
    }
    const bookingDate = getDateOnly(booking.date);
    if (!isBookableDate(bookingDate)
        || (bookingDate === getChinaDate() && booking.endTime <= getChinaCurrentTime())) {
        showToast('已过期预约不能修改', 'error');
        return;
    }
    closeDetailModal();
    showAddBookingForm(booking.studio, booking);
}

// 关闭详情弹窗
function closeDetailModal() {
    document.getElementById('bookingDetailModal').classList.add('hidden');
    selectedBookingId = null;
}

// 删除预约
async function deleteBooking() {
    showCancelBookingConfirm(selectedBookingId);
}

async function deleteBookingById(bookingId, options = {}) {
    if (!bookingId) return false;

    const { closeAfterDelete = true, onDeleted = null } = options;
    const booking = allBookings.find(item => item.id === bookingId);
    if (!booking) {
        showToast('预约不存在或已取消', 'error');
        return false;
    }
    if (!canCancelBooking(booking)) {
        showToast('只能取消自己的预约', 'error');
        return false;
    }

    try {
        if (isCloudMode()) {
            // 云端模式：调用 API
            const response = await apiFetch(`/api/bookings/${bookingId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `删除失败: ${response.status}`);
            }

            // 重新加载数据
            await loadBookings();
        } else {
            // 本地模式：从数组中删除
            allBookings = allBookings.filter(b => b.id !== bookingId);
            saveBookings();
            renderAllViews();
        }

        showToast('预约已取消', 'success');
        if (typeof onDeleted === 'function') {
            onDeleted();
        }
        if (closeAfterDelete) {
            closeDetailModal();
        }
        return true;
    } catch (error) {
        console.error('取消预约失败:', error);
        showToast('取消预约失败，请重试', 'error');
        return false;
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
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
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
function switchView(view) {
    currentView = view;

    // 更新桌面端按钮状态
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
        // 简单的文本匹配检查
        if (btn.textContent.includes(view === 'list' ? '大厅' : '统计')) {
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

    if (view === 'list') {
        document.getElementById('listView').classList.remove('hidden');
        renderBookings();
    } else if (view === 'stats') {
        document.getElementById('statsView').classList.remove('hidden');
        initStatsView();
        renderStatsView();
    } else if (view === 'users') {
        if (userMgmtView) {
            userMgmtView.classList.remove('hidden');
            renderUserManagement();
        }
    }
}

// 选择日期范围
function selectDateRange(range, btn) {
    currentDateRange = range;

    // 更新按钮状态
    document.querySelectorAll('.date-btn').forEach(b => {
        b.classList.remove('active');
    });
    if (btn) {
        btn.classList.add('active');
    }

    // 重新渲染视图
    if (currentView === 'list') {
        renderBookings();
    } else if (currentView === 'stats') {
        // 统计视图不需要日期范围切换，因为它有自己的月份筛选器
        // 但如果未来需要，可以在这里添加
    }

    // 更新今日使用情况
    updateTodayUsage();
}

// 显示日期选择器
function showDatePicker() {
    const input = document.createElement('input');
    input.type = 'date';
    input.style.position = 'fixed';
    input.style.top = '-100px';
    input.style.left = '-100px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);

    const cleanup = () => {
        if (input.parentNode) {
            document.body.removeChild(input);
        }
    };

    input.addEventListener('change', () => {
        selectedDate = input.value;
        currentDateRange = 'custom';

        // 更新按钮状态
        document.querySelectorAll('.date-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('.date-picker-btn').classList.add('active');

        // 重新渲染
        if (currentView === 'list') {
            renderBookings();
        }

        cleanup();
    });

    // 如果用户取消选择，也要清理
    input.addEventListener('blur', () => {
        setTimeout(cleanup, 200);
    });

    input.click();
}

// 渲染时间轴视图
function renderTimelineView() {
    // 时间轴配置
    const startHour = 9;
    const endHour = 18;
    const hourHeight = 28; // 与 CSS 中的 timeline-time-slot 高度一致

    // 获取要显示的日期列表
    const dates = getDisplayDates();

    // 获取筛选后的预约
    const filteredBookings = getFilteredBookings();

    // 为每个影棚渲染时间轴
    getAllStudios().forEach((studioInfo, index) => {
        const studio = studioInfo.id;
        const timelineBody = document.getElementById(`timeline${index + 1}Body`);
        if (!timelineBody) return;

        timelineBody.innerHTML = '';

        // 创建时间轴内容容器
        const timelineContent = document.createElement('div');
        timelineContent.className = 'timeline-content';

        // 创建时间列
        const timeCol = document.createElement('div');
        timeCol.className = 'timeline-time-col';

        for (let hour = startHour; hour <= endHour; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'timeline-time-slot';
            timeSlot.textContent = `${String(hour).padStart(2, '0')}:00`;
            timeCol.appendChild(timeSlot);
        }
        timelineContent.appendChild(timeCol);

        // 创建预约列
        const bookingCol = document.createElement('div');
        bookingCol.className = 'timeline-booking-col';
        bookingCol.style.position = 'relative';
        bookingCol.style.height = ((endHour - startHour + 1) * hourHeight) + 'px';

        // 创建时间槽背景
        for (let hour = startHour; hour <= endHour; hour++) {
            const slot = document.createElement('div');
            slot.className = 'timeline-booking-slot';
            bookingCol.appendChild(slot);
        }

        // 获取该影棚的预约
        const studioBookings = filteredBookings.filter(b => {
            const bookingDate = getDateOnly(b.date);
            return b.studio === studio && dates.includes(bookingDate);
        });

        // 渲染预约块
        studioBookings.forEach(booking => {
            const startParts = booking.startTime.split(':');
            const endParts = booking.endTime.split(':');

            const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
            const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

            // 计算位置和高度
            const startFromTop = startMinutes - (startHour * 60);
            const duration = endMinutes - startMinutes;

            // 只显示在时间轴范围内的预约
            if (startMinutes >= startHour * 60 && startMinutes < (endHour + 1) * 60) {
                const top = (startFromTop / 60) * hourHeight;
                const height = Math.max((duration / 60) * hourHeight - 4, 18); // 最小高度18px

                const bookingBlock = createTimelineBookingBlock(booking);
                bookingBlock.style.position = 'absolute';
                bookingBlock.style.top = top + 'px';
                bookingBlock.style.height = height + 'px';

                bookingCol.appendChild(bookingBlock);
            }
        });

        timelineContent.appendChild(bookingCol);
        timelineBody.appendChild(timelineContent);
    });
}

// 创建时间轴预约块
function createTimelineBookingBlock(booking) {
    const block = document.createElement('div');
    const isMyBooking = booking.photographer === currentUser;
    const status = getBookingStatus(booking);
    const statusClass = status === 'completed' ? 'booking-completed' : '';
    const studioInfo = getStudioById(booking.studio);

    block.className = `timeline-booking-block ${isMyBooking ? 'my-booking' : ''} ${statusClass}`;
    block.setAttribute('data-studio', booking.studio);
    block.setAttribute('data-studio-group', studioInfo ? studioInfo.groupKey : 'unknown');
    block.onclick = () => showBookingDetail(booking.id);

    const timeDiv = document.createElement('div');
    timeDiv.className = 'timeline-booking-time';
    timeDiv.textContent = `${booking.startTime}-${booking.endTime}`;
    block.appendChild(timeDiv);

    const userDiv = document.createElement('div');
    userDiv.className = 'timeline-booking-user';
    userDiv.textContent = booking.photographer;
    block.appendChild(userDiv);

    if (booking.note) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'timeline-booking-note';
        noteDiv.textContent = booking.note;
        block.appendChild(noteDiv);
    }

    return block;
}

// 显示新建预约表单并预填时间
function showAddBookingFormWithTime(studio, startHour) {
    showAddBookingForm(studio);

    // 预填开始时间
    const startTime = `${String(startHour).padStart(2, '0')}:00`;
    const endTime = `${String(startHour + 1).padStart(2, '0')}:00`;

    document.getElementById('startTime').value = startTime;
    document.getElementById('endTime').value = endTime;
}

// 获取指定小时内的预约（只返回在该小时开始的预约，避免重复显示）
function getBookingsForHourSlot(studio, dates, hour, bookingsToUse = allBookings) {
    return bookingsToUse.filter(booking => {
        if (booking.studio !== studio) return false;

        // 处理 ISO 格式日期
        const bookingDate = getDateOnly(booking.date);
        if (!dates.includes(bookingDate)) return false;

        // 解析预约的开始时间
        const startTimeParts = booking.startTime.split(':');
        const bookingStartHour = parseInt(startTimeParts[0]);

        // 只在预约开始时间所在的小时格子显示
        return hour === bookingStartHour;
    });
}

// 获取要显示的日期
function getDisplayDates() {
    switch (currentDateRange) {
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

// 格式化日期为字符串
function formatDateToString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 从日期字符串中提取日期部分（处理 ISO 格式）
function getDateOnly(dateStr) {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
}

// 创建时间轴预约项
function createTimelineBookingItem(booking) {
    const item = document.createElement('div');
    const isMyBooking = booking.photographer === currentUser;
    const studioInfo = getStudioById(booking.studio);

    // 判断预约状态
    const status = getBookingStatus(booking);
    const statusClass = status === 'completed' ? 'booking-completed' : '';

    item.className = `timeline-booking-item ${isMyBooking ? 'my-booking' : ''} ${statusClass}`;
    item.setAttribute('data-studio', booking.studio);
    item.setAttribute('data-studio-group', studioInfo ? studioInfo.groupKey : 'unknown');
    item.onclick = () => showBookingDetail(booking.id);

    // 添加已过期标签
    if (status === 'completed') {
        const expiredLabel = document.createElement('div');
        expiredLabel.className = 'expired-label';
        expiredLabel.textContent = '已过期';
        item.appendChild(expiredLabel);
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'timeline-booking-time';
    timeDiv.textContent = `${booking.startTime}-${booking.endTime}`;
    item.appendChild(timeDiv);

    const userDiv = document.createElement('div');
    userDiv.className = 'timeline-booking-user';
    userDiv.textContent = booking.photographer;
    item.appendChild(userDiv);

    if (booking.note) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'timeline-booking-note';
        noteDiv.textContent = booking.note;
        item.appendChild(noteDiv);
    }

    return item;
}

// 判断预约状态
function getBookingStatus(booking) {
    const now = new Date();
    const todayStr = formatDateToString(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 提取日期部分（处理 ISO 格式）
    const bookingDate = getDateOnly(booking.date);

    // 不是今天的预约
    if (bookingDate < todayStr) {
        return 'completed'; // 过去的日期
    } else if (bookingDate > todayStr) {
        return 'upcoming'; // 未来的日期
    }

    // 今天的预约，判断时间
    const startTime = booking.startTime.split(':');
    const startMinutes = parseInt(startTime[0]) * 60 + parseInt(startTime[1]);
    const endTime = booking.endTime.split(':');
    const endMinutes = parseInt(endTime[0]) * 60 + parseInt(endTime[1]);

    if (endMinutes <= currentMinutes) {
        return 'completed'; // 已结束
    } else if (startMinutes <= currentMinutes && currentMinutes < endMinutes) {
        return 'ongoing'; // 进行中
    } else {
        return 'upcoming'; // 未开始
    }
}

// 应用筛选
function applyFilters() {
    renderBookings();
}

// 获取筛选后的预约列表（仅用于时间轴和列表视图）
// 注意：统计视图使用 allBookings，不使用此函数
function getFilteredBookings() {
    let filtered = [...allBookings];

    // 首先过滤掉昨天及之前的预约（只保留今天及以后的）
    const today = getChinaDate();
    filtered = filtered.filter(b => getDateOnly(b.date) >= today);

    // 只看我的预约
    const filterMyBookings = document.getElementById('filterMyBookings');
    if (filterMyBookings && filterMyBookings.checked) {
        filtered = filtered.filter(b => b.photographer === currentUser);
    }

    return filtered;
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
    // updateTodayUsage 和 renderTimelineView 已经在 loadBookings -> renderAllViews 中被调用了，这里只需初始化提醒

    // 初始化提醒功能
    initReminder();
};

// 移除底部的 loadBookings 覆盖，因为我们已经修改了原始函数
// ============ 提醒功能 ============

// 请求通知权限
async function requestNotificationPermission() {
    console.log('===== 请求通知权限 =====');

    if (!('Notification' in window)) {
        console.error('❌ 浏览器不支持通知功能');
        showToast('您的浏览器不支持通知功能', 'error');
        return false;
    }

    console.log('当前权限状态:', Notification.permission);

    // 如果已经授权，直接返回true
    if (Notification.permission === 'granted') {
        console.log('✅ 通知权限已授予');
        showToast('通知权限已开启', 'success');
        return true;
    }

    // 如果被拒绝，提示用户手动开启
    if (Notification.permission === 'denied') {
        console.warn('❌ 通知权限已被拒绝');
        showToast('通知权限被拒绝，请在浏览器设置中允许', 'error');
        alert('通知权限已被拒绝\n\n手动开启方法：\n1. 点击地址栏左侧的锁图标\n2. 找到"通知"选项\n3. 改为"允许"\n4. 刷新页面');
        return false;
    }

    // 权限状态为 default，请求授权
    try {
        console.log('📝 正在请求通知权限...');
        const permission = await Notification.requestPermission();
        console.log('用户选择:', permission);

        if (permission === 'granted') {
            console.log('✅ 用户授予了通知权限');
            showToast('通知权限已开启！', 'success');

            // 发送欢迎通知
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

            return true;
        } else {
            console.warn('❌ 用户拒绝了通知权限');
            showToast('您拒绝了通知权限', 'error');
            return false;
        }
    } catch (error) {
        console.error('❌ 请求通知权限出错:', error);
        showToast('请求权限失败: ' + error.message, 'error');
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
    const now = new Date();
    const todayStr = formatDateToString(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

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
    console.log('===== 发送通知 =====');
    console.log('标题:', title);
    console.log('内容:', body);

    // 检查浏览器支持
    if (!('Notification' in window)) {
        console.error('❌ 浏览器不支持通知');
        return;
    }

    // 检查权限
    const permission = Notification.permission;
    console.log('当前权限:', permission);

    if (permission === 'granted') {
        try {
            console.log('📤 正在创建通知...');
            const notification = new Notification(title, {
                body: body,
                icon: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f4f7.png',
                badge: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f514.png',
                tag: 'booking-' + Date.now(),
                requireInteraction: false,
                silent: true // 不使用系统声音，因为我们有自定义声音
            });

            notification.onshow = function() {
                console.log('✅ 通知已显示');
            };

            notification.onclick = function() {
                console.log('👆 通知被点击');
                window.focus();
                notification.close();
            };

            notification.onerror = function(e) {
                console.error('❌ 通知显示错误:', e);
            };

            console.log('✅ 通知创建成功');
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
            console.log('✅ 音频上下文已解锁');
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
        console.log('无法播放提示音:', error);
    }
}

// 初始化提醒功能
function initReminder() {
    // 恢复保存的设置
    const reminderEnabled = localStorage.getItem('reminderEnabled') === 'true';
    const enableReminderCheckbox = document.getElementById('enableReminder');

    if (reminderEnabled && enableReminderCheckbox) {
        enableReminderCheckbox.checked = true;

        // 自动请求权限并开启提醒
        requestNotificationPermission().then(granted => {
            if (granted) {
                startReminderCheck();
            } else {
                enableReminderCheckbox.checked = false;
                localStorage.setItem('reminderEnabled', 'false');
            }
        });
    }
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

    modal.classList.remove('hidden');

    // 5秒后自动关闭（可选）
    // setTimeout(() => {
    //     closeReminderModal();
    // }, 5000);
}

// 关闭提醒弹窗
function closeReminderModal() {
    const modal = document.getElementById('reminderModal');
    modal.classList.add('hidden');
}

// 测试提醒功能
function testReminder() {
    console.log('===== 测试提醒功能 =====');

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
    console.log('1️⃣ 播放提示音 (状态: ' + audioStatus + ')');
    playNotificationSound();

    // 2. 发送系统通知
    console.log('2️⃣ 发送系统通知');
    sendNotification('🔔 测试提醒成功', '声音和通知功能正常！\n(请保持网页在前台运行)');

    // 3. 显示页面弹窗
    console.log('3️⃣ 显示页面弹窗');
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
    console.log('=== 渲染统计视图 ===');
    console.log('总预约数:', allBookings.length);

    const selectedMonth = document.getElementById('statsMonth');
    const selectedStudio = document.getElementById('statsStudio');

    // 检查元素是否存在
    if (!selectedMonth || !selectedStudio) {
        console.error('统计视图元素未找到');
        return;
    }

    const monthValue = selectedMonth.value;
    const studioValue = selectedStudio.value;

    console.log('选择的月份:', monthValue);
    console.log('选择的影棚:', studioValue);

    // 根据选择过滤预约（使用 allBookings，包含所有历史数据）
    let filteredBookings = [...allBookings];

    if (monthValue !== 'all') {
        filteredBookings = filteredBookings.filter(b => b.date.startsWith(monthValue));
    }

    if (studioValue !== 'all') {
        filteredBookings = filteredBookings.filter(b => b.studio === studioValue);
    }

    console.log('过滤后的预约数:', filteredBookings.length);

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
        console.log('统计数据为空');
        return;
    }

    console.log('生成统计表格，摄影师数量:', statsArray.length);

    tableBody.innerHTML = statsArray.map((stat, index) => {
        const rank = index + 1;
        const percentage = totalHours > 0 ? (stat.totalHours / totalHours * 100) : 0;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';

        return `
            <tr class="${rankClass}">
                <td>${rank}</td>
                <td>${stat.photographer}</td>
                <td>${stat.count}</td>
                <td>${stat.totalHours.toFixed(1)}h</td>
                <td>${stat.avgHours.toFixed(1)}h</td>
                <td>${percentage.toFixed(1)}%</td>
            </tr>
        `;
    }).join('');
}
