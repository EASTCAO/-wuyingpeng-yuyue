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

    // 两个开关留在工具栏：状态要一眼可见，尤其"提醒"
    assert.match(html, /class="toolbar-switches"[\s\S]*?id="filterMyBookings"/);
    assert.match(html, /class="toolbar-switches"[\s\S]*?id="enableReminder"/);

    // 低频入口收进用户菜单，条件显示的两项也要在
    assert.match(html, /user-menu-item[^"]*simple-video-link/);
    assert.match(html, /user-menu-item[^"]*admin-only/);
    // 菜单收起时用小红点提示未读待办
    assert.match(script, /getElementById\('userMenuDot'\)\?\.classList\.toggle\('hidden', count === 0\)/);
});
