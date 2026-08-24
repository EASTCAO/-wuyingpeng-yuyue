const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('弹窗具备对话框语义和可访问标题', () => {
    for (const modalId of [
        'addBookingModal',
        'bookingDetailModal',
        'cancelBookingModal',
        'reminderModal',
        'changePasswordModal'
    ]) {
        assert.match(html, new RegExp(`id="${modalId}"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby=`));
    }
});

test('关键表单控件都由 label 明确关联', () => {
    for (const controlId of [
        'photographerName',
        'loginPassword',
        'statsMonth',
        'statsStudio',
        'studioSelect',
        'bookingDate',
        'startTime',
        'endTime',
        'currentPassword',
        'newPassword',
        'confirmPassword'
    ]) {
        assert.match(html, new RegExp(`<label[^>]*for="${controlId}"`));
    }
});

test('弹窗统一管理焦点并支持 Escape 和 Tab 循环', () => {
    assert.match(script, /function openAccessibleModal\(/);
    assert.match(script, /function closeAccessibleModal\(/);
    assert.match(script, /event\.key === 'Escape'/);
    assert.match(script, /event\.key !== 'Tab'/);
});

test('右上角用户菜单具备下拉语义并能被键盘和点击外部关闭', () => {
    assert.match(html, /id="userMenuButton"[\s\S]*?aria-haspopup="true"/);
    assert.match(html, /aria-expanded="false"[\s\S]*?aria-controls="userMenu"/);
    assert.match(html, /id="userMenu"[^>]*role="menu"[^>]*aria-labelledby="userMenuButton"/);
    assert.match(html, /class="user-menu-item[^"]*"[^>]*>/);

    // 展开状态要同步到 aria-expanded，否则读屏用户不知道菜单开着
    assert.match(script, /button\.setAttribute\('aria-expanded', 'true'\)/);
    assert.match(script, /button\.setAttribute\('aria-expanded', 'false'\)/);
    // Escape 关闭并把焦点还给按钮
    assert.match(script, /event\.key === 'Escape' && isUserMenuOpen\(\)/);
    assert.match(script, /closeUserMenu\(\{ restoreFocus: true \}\)/);
    // 点击菜单外部关闭
    assert.match(script, /event\.target\.closest\('\.user-menu'\)/);
});

test('侧栏已移除，入口分别落在工具栏和用户菜单里', () => {
    assert.doesNotMatch(html, /class="sidebar"/);
    assert.doesNotMatch(html, /sidebar-overlay/);
    assert.doesNotMatch(html, /mobile-menu-btn/);
    assert.doesNotMatch(script, /closeSidebar|toggleSidebar|initMobileSidebar/);

    // 提醒开关收进用户菜单：不占主界面空间，但用户仍能确认它开着、必要时关掉
    assert.match(html, /class="user-menu-switch"[\s\S]*?id="enableReminder"/);

    // "只看我的" 是无效控件（只被没有调用方的时间轴视图读取），已连同死代码一起删除
    assert.doesNotMatch(html, /filterMyBookings/);
    assert.doesNotMatch(script, /filterMyBookings|getFilteredBookings|renderTimelineView/);

    // 低频入口收进用户菜单，条件显示的两项也要在
    assert.match(html, /user-menu-item[^"]*simple-video-link/);
    assert.match(html, /user-menu-item[^"]*admin-only/);
    // 菜单收起时用小红点提示未读待办
    assert.match(script, /getElementById\('userMenuDot'\)\?\.classList\.toggle\('hidden', count === 0\)/);
});

test('提醒默认开启，且加载时的授权请求不打扰用户', () => {
    // 没存过偏好就默认开启，只有显式关掉过才保持关闭
    assert.match(script, /const stored = localStorage\.getItem\('reminderEnabled'\)/);
    assert.match(script, /const enabled = stored === null \? true : stored === 'true'/);

    // 自动请求走静默模式：不弹 toast、不弹 alert、不发欢迎通知
    assert.match(script, /requestNotificationPermission\(\{ silent: true \}\)/);
    assert.match(script, /async function requestNotificationPermission\(\{ silent = false \} = \{\}\)/);
    assert.match(script, /if \(!silent\) \{\s*\n\s*showToast\('通知权限被拒绝[\s\S]*?alert\(/);

    // 没拿到权限时不要写死 localStorage，否则下次打开就不再尝试了
    assert.doesNotMatch(script, /checkbox\.checked = false;\s*\n\s*localStorage\.setItem\('reminderEnabled', 'false'\)/);
});
