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

test('手机端切换视图后自动收起侧栏', () => {
    assert.match(script, /async function switchView\(view\)[\s\S]*window\.innerWidth <= 768\) closeSidebar\(\)/);
});
