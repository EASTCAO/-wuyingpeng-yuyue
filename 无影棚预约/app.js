// 全局变量
let currentUser = null;
let allBookings = [];
let selectedBookingId = null;
let currentView = 'list'; // 'timeline' or 'list'
let currentDateRange = 'today'; // 'today', 'tomorrow', 'week'
let selectedDate = null;
let reminderInterval = null;
let notifiedBookings = new Set(); // 记录已通知的预约ID
let soundEnabled = true;
let globalAudioContext = null; // 全局 AudioContext

// ============ API 配置 ============
// 部署后端后，将此 URL 改为你的后端地址，例如：'https://your-app.zeabur.app'
// 设置为空字符串则使用本地 localStorage
const API_BASE_URL = 'https://studiowuhanyy.zeabur.app';

// 检查是否使用云端同步
function isCloudMode() {
    return API_BASE_URL && API_BASE_URL.length > 0;
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

    // 检查是否已登录
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        showMainPage();
    } else {
        // 检查是否有保存的登录信息，自动登录
        const rememberMe = localStorage.getItem('rememberMe');
        const savedUsername = localStorage.getItem('savedUsername');
        const savedPassword = localStorage.getItem('savedPassword');

        if (rememberMe === 'true' && savedUsername && savedPassword) {
            document.getElementById('photographerName').value = savedUsername;
            document.getElementById('loginPassword').value = savedPassword;
            document.getElementById('rememberMe').checked = true;
            // 自动登录
            login();
        }
    }

    // 设置今天的日期为默认值
    const today = new Date().toISOString().split('T')[0];
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
// 在这里设置允许登录的用户名和密码
const USERS = {
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
    'admin': '123456'
};

// 登录
function login() {
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

    // 先检查是否有自定义密码（存储在 localStorage 中）
    const customPasswords = JSON.parse(localStorage.getItem('customPasswords') || '{}');

    // 验证用户名和密码
    // 优先使用自定义密码，如果没有则使用默认密码
    const correctPassword = customPasswords[name] || USERS[name];

    if (USERS[name] && correctPassword === password) {
        currentUser = name;
        localStorage.setItem('currentUser', name);

        // 记住密码功能
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
        localStorage.removeItem('currentUser');
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
async function loadBookings() {
    console.log('开始加载预约数据...');

    if (isCloudMode()) {
        // 云端模式：从 API 加载
        try {
            const response = await fetch(`${API_BASE_URL}/api/bookings`);
            if (!response.ok) throw new Error('加载失败');
            allBookings = await response.json();
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
    if (currentView === 'timeline') renderTimelineView();
    else if (currentView === 'list') renderBookings();
    else if (currentView === 'stats') { initStatsView(); renderStatsView(); }
    updateTodayUsage();
}

// 渲染预约列表（列表视图）
// 根据日期筛选器显示预约
function renderBookings() {
    const studio1List = document.getElementById('studio1List');
    const studio2List = document.getElementById('studio2List');

    // 获取要显示的日期范围
    const displayDates = getDisplayDates();

    // 按影棚分组，并根据日期筛选
    const studio1Bookings = allBookings.filter(b =>
        b.studio === '无影棚1号' && displayDates.includes(getDateOnly(b.date))
    );
    const studio2Bookings = allBookings.filter(b =>
        b.studio === '无影棚2号' && displayDates.includes(getDateOnly(b.date))
    );

    // 渲染无影棚1号
    if (studio1Bookings.length === 0) {
        studio1List.innerHTML = '<p class="empty-message">暂无预约</p>';
    } else {
        studio1List.innerHTML = studio1Bookings.map(booking => createBookingCard(booking)).join('');
    }

    // 渲染无影棚2号
    if (studio2Bookings.length === 0) {
        studio2List.innerHTML = '<p class="empty-message">暂无预约</p>';
    } else {
        studio2List.innerHTML = studio2Bookings.map(booking => createBookingCard(booking)).join('');
    }
}

// 创建预约卡片
function createBookingCard(booking) {
    const isMyBooking = booking.photographer === currentUser;
    const myBookingClass = isMyBooking ? 'my-booking' : '';

    // 判断预约状态
    const status = getBookingStatus(booking);
    const statusClass = status === 'completed' ? 'booking-completed' : '';
    const expiredLabel = status === 'completed' ? '<div class="expired-label">已过期</div>' : '';

    return `
        <div class="booking-card ${myBookingClass} ${statusClass}" onclick="showBookingDetail('${booking.id}')">
            ${expiredLabel}
            <div class="booking-info">
                <div class="booking-time">${booking.startTime} - ${booking.endTime}</div>
                <div class="booking-date">${formatDate(booking.date)}</div>
                <div class="booking-photographer">📷 ${booking.photographer}</div>
            </div>
            ${booking.note ? `<div class="booking-note">${booking.note}</div>` : ''}
        </div>
    `;
}

// 格式化日期
function formatDate(dateStr) {
    // 处理 ISO 格式日期，只取日期部分
    const dateOnly = dateStr.split('T')[0];
    const date = new Date(dateOnly + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 重置时间为零点，便于比较
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) {
        return '今天 ' + dateOnly;
    } else if (date.getTime() === tomorrow.getTime()) {
        return '明天 ' + dateOnly;
    } else {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `${dateOnly} ${weekdays[date.getDay()]}`;
    }
}

// 显示新建预约表单
function showAddBookingForm(defaultStudio) {
    document.getElementById('addBookingModal').classList.remove('hidden');

    // 重置表单
    const studioSelect = document.getElementById('studioSelect');
    if (defaultStudio) {
        studioSelect.value = defaultStudio;
    } else {
        studioSelect.value = '无影棚1号';
    }

    // 根据当前日期筛选器设置默认日期
    const displayDates = getDisplayDates();
    const defaultDate = displayDates[0]; // 使用筛选器的第一个日期
    document.getElementById('bookingDate').value = defaultDate;
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
    document.getElementById('bookingNote').value = '';
}

// 关闭新建预约表单
function closeAddBookingForm() {
    const modal = document.getElementById('addBookingModal');
    if (modal) {
        modal.classList.add('hidden');
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

    if (startTime >= endTime) {
        showToast('结束时间必须晚于开始时间', 'error');
        return;
    }

    // 检查时间冲突
    const hasConflict = allBookings.some(booking => {
        if (booking.studio !== studio || booking.date !== date) {
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
    const newBooking = {
        id: String(Date.now()), // 使用时间戳作为 ID
        studio: studio,
        date: date,
        startTime: startTime,
        endTime: endTime,
        photographer: currentUser,
        note: note,
        createdAt: Date.now()
    };

    try {
        if (isCloudMode()) {
            // 云端模式：调用 API
            console.log('正在保存预约到云端...');
            const response = await fetch(`${API_BASE_URL}/api/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newBooking)
            });

            if (!response.ok) throw new Error('保存失败');

            // 重新加载数据以获取最新状态
            await loadBookings();
        } else {
            // 本地模式：保存到 localStorage
            console.log('正在保存预约到 localStorage...');
            allBookings.push(newBooking);
            saveBookings();
            sortBookings();
            renderAllViews();
        }

        console.log('✅ 预约保存成功');
        showToast('预约成功', 'success');
        closeAddBookingForm();

    } catch (error) {
        console.error('❌ 预约失败:', error);
        showToast('预约失败：' + error.message, 'error');
    }
}

// 显示预约详情
function showBookingDetail(bookingId) {
    selectedBookingId = bookingId;
    const booking = allBookings.find(b => b.id === bookingId);

    if (!booking) return;

    const isMyBooking = booking.photographer === currentUser;

    const detailHtml = `
        <div class="detail-item">
            <div class="detail-label">影棚</div>
            <div class="detail-value">${booking.studio}</div>
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
            <div class="detail-value">${booking.photographer}</div>
        </div>
        ${booking.note ? `
        <div class="detail-item">
            <div class="detail-label">备注</div>
            <div class="detail-value">${booking.note}</div>
        </div>
        ` : ''}
    `;

    document.getElementById('bookingDetailContent').innerHTML = detailHtml;

    // 如果是自己的预约，显示删除按钮
    const actionsHtml = isMyBooking ? `
        <button onclick="deleteBooking()" class="btn btn-danger">取消预约</button>
        <button onclick="closeDetailModal()" class="btn btn-secondary">关闭</button>
    ` : `
        <button onclick="closeDetailModal()" class="btn btn-secondary">关闭</button>
    `;

    document.getElementById('detailActions').innerHTML = actionsHtml;

    document.getElementById('bookingDetailModal').classList.remove('hidden');
}

// 关闭详情弹窗
function closeDetailModal() {
    document.getElementById('bookingDetailModal').classList.add('hidden');
    selectedBookingId = null;
}

// 删除预约
async function deleteBooking() {
    if (!confirm('确定要取消这个预约吗？')) {
        return;
    }

    try {
        if (isCloudMode()) {
            // 云端模式：调用 API
            const response = await fetch(`${API_BASE_URL}/api/bookings/${selectedBookingId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('删除失败');

            // 重新加载数据
            await loadBookings();
        } else {
            // 本地模式：从数组中删除
            allBookings = allBookings.filter(b => b.id !== selectedBookingId);
            saveBookings();
            renderAllViews();
        }

        showToast('预约已取消', 'success');
        closeDetailModal();
    } catch (error) {
        console.error('取消预约失败:', error);
        showToast('取消预约失败，请重试', 'error');
    }
}

// 渲染我的预约
function renderMyBookings() {
    const myBookingsList = document.getElementById('myBookingsList');
    const myBookings = allBookings.filter(b => b.photographer === currentUser);

    if (myBookings.length === 0) {
        myBookingsList.innerHTML = '<p class="empty-message">您还没有预约</p>';
    } else {
        myBookingsList.innerHTML = myBookings.map(booking => `
            <div class="booking-card my-booking" onclick="showBookingDetail('${booking.id}')">
                <div class="booking-info">
                    <div>
                        <div class="booking-time">${booking.startTime} - ${booking.endTime}</div>
                        <div class="booking-date">${formatDate(booking.date)}</div>
                    </div>
                    <div class="booking-photographer">${booking.studio}</div>
                </div>
                ${booking.note ? `<div class="booking-note">${booking.note}</div>` : ''}
            </div>
        `).join('');
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
        if (btn.textContent.includes(view === 'timeline' ? '时间轴' : view === 'list' ? '列表' : '统计')) {
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
    document.getElementById('timelineView').classList.add('hidden');
    document.getElementById('listView').classList.add('hidden');
    document.getElementById('statsView').classList.add('hidden');

    if (view === 'timeline') {
        document.getElementById('timelineView').classList.remove('hidden');
        renderTimelineView();
    } else if (view === 'list') {
        document.getElementById('listView').classList.remove('hidden');
        renderBookings();
    } else if (view === 'stats') {
        document.getElementById('statsView').classList.remove('hidden');
        initStatsView();
        renderStatsView();
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
    if (currentView === 'timeline') {
        renderTimelineView();
    } else if (currentView === 'list') {
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
        if (currentView === 'timeline') {
            renderTimelineView();
        } else if (currentView === 'list') {
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
    const timelineBody = document.getElementById('timelineBody');
    timelineBody.innerHTML = '';

    // 获取要显示的日期列表
    const dates = getDisplayDates();

    // 获取筛选后的预约
    const filteredBookings = getFilteredBookings();

    // 时间轴配置
    const startHour = 9;
    const endHour = 18;
    const hourHeight = 50; // 每小时的高度（像素）

    // 创建时间列
    const timeColumn = document.createElement('div');
    timeColumn.className = 'timeline-time-column-container';

    for (let hour = startHour; hour <= endHour; hour++) {
        const timeCell = document.createElement('div');
        timeCell.className = 'timeline-time-cell';
        timeCell.style.height = hourHeight + 'px';
        timeCell.textContent = `${String(hour).padStart(2, '0')}:00`;
        timeColumn.appendChild(timeCell);
    }
    timelineBody.appendChild(timeColumn);

    // 为每个影棚创建列
    ['无影棚1号', '无影棚2号'].forEach(studio => {
        const studioColumn = document.createElement('div');
        studioColumn.className = 'timeline-studio-column-container';
        studioColumn.style.position = 'relative';
        studioColumn.style.height = ((endHour - startHour + 1) * hourHeight) + 'px';

        // 创建小时格子背景
        for (let hour = startHour; hour <= endHour; hour++) {
            const hourCell = document.createElement('div');
            hourCell.className = 'timeline-hour-cell';
            hourCell.style.height = hourHeight + 'px';
            studioColumn.appendChild(hourCell);
        }

        // 获取该影棚在选定日期的预约
        const studioBookings = filteredBookings.filter(b => {
            const bookingDate = getDateOnly(b.date);
            return b.studio === studio && dates.includes(bookingDate);
        });

        // 渲染预约（使用绝对定位）
        studioBookings.forEach(booking => {
            const startParts = booking.startTime.split(':');
            const endParts = booking.endTime.split(':');

            const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
            const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

            // 计算位置和高度
            const startFromTop = startMinutes - (startHour * 60); // 从09:00开始的分钟数
            const duration = endMinutes - startMinutes;

            // 只显示在时间轴范围内的预约
            if (startMinutes >= startHour * 60 && startMinutes < (endHour + 1) * 60) {
                const top = (startFromTop / 60) * hourHeight;
                const height = Math.max((duration / 60) * hourHeight, 30); // 最小高度30px

                const bookingItem = createTimelineBookingItem(booking);
                bookingItem.style.position = 'absolute';
                bookingItem.style.top = top + 'px';
                bookingItem.style.left = '4px';
                bookingItem.style.right = '4px';
                bookingItem.style.height = height + 'px';
                bookingItem.style.zIndex = '10';

                studioColumn.appendChild(bookingItem);
            }
        });

        timelineBody.appendChild(studioColumn);
    });
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (currentDateRange) {
        case 'today':
            return [formatDateToString(today)];
        case 'tomorrow':
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return [formatDateToString(tomorrow)];
        case 'week':
            const dates = [];
            for (let i = 0; i < 7; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() + i);
                dates.push(formatDateToString(date));
            }
            return dates;
        case 'custom':
            return selectedDate ? [selectedDate] : [formatDateToString(today)];
        default:
            return [formatDateToString(today)];
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

    // 判断预约状态
    const status = getBookingStatus(booking);
    const statusClass = status === 'completed' ? 'booking-completed' : '';

    item.className = `timeline-booking-item ${isMyBooking ? 'my-booking' : ''} ${statusClass}`;
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
    if (currentView === 'timeline') {
        renderTimelineView();
    } else {
        renderBookings();
    }
}

// 获取筛选后的预约列表（仅用于时间轴和列表视图）
// 注意：统计视图使用 allBookings，不使用此函数
function getFilteredBookings() {
    let filtered = [...allBookings];

    // 首先过滤掉昨天及之前的预约（只保留今天及以后的）
    const today = formatDateToString(new Date());
    filtered = filtered.filter(b => getDateOnly(b.date) >= today);

    // 只看我的预约
    const filterMyBookings = document.getElementById('filterMyBookings');
    if (filterMyBookings && filterMyBookings.checked) {
        filtered = filtered.filter(b => b.photographer === currentUser);
    }

    // 搜索过滤
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value.trim()) {
        const searchTerm = searchInput.value.trim().toLowerCase();
        filtered = filtered.filter(b =>
            b.photographer.toLowerCase().includes(searchTerm) ||
            (b.note && b.note.toLowerCase().includes(searchTerm))
        );
    }

    return filtered;
}

// 更新今日使用情况
function updateTodayUsage() {
    const today = formatDateToString(new Date());
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

    document.getElementById('todayUsage').textContent = `${totalHours.toFixed(1)}h`;
}

// 修改 showMainPage 函数以初始化新UI
const originalShowMainPage = showMainPage;
showMainPage = function() {
    originalShowMainPage();
    // updateTodayUsage 和 renderTimelineView 已经在 loadBookings -> renderAllViews 中被调用了，这里只需初始化监听
    
    // 添加搜索框事件监听
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }

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

