const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const studioStyles = fs.readFileSync(path.join(root, 'studio-layout.css'), 'utf8');

test('全局界面不再加载 Apple 风格覆盖层', () => {
    assert.doesNotMatch(styles, /Apple-inspired utility UI/);
    assert.doesNotMatch(styles, /Apple-style interaction and layout refinement pass/);
    assert.doesNotMatch(studioStyles, /Apple-inspired product-surface refinements/);
});

test('登录页保持正式站的卡片和按钮尺寸', () => {
    assert.match(styles, /\.login-card\s*\{[\s\S]*?padding: 30px;[\s\S]*?border-radius: var\(--radius-lg\);[\s\S]*?box-shadow: var\(--shadow-raised\)/);
    assert.match(styles, /\.login-form input\s*\{[\s\S]*?padding: 10px 12px 10px 36px;[\s\S]*?border-radius: var\(--radius-md\);/);
    assert.match(styles, /\.login-btn\s*\{[\s\S]*?min-height: 42px;[\s\S]*?border-radius: var\(--radius-md\);/);
    assert.match(styles, /\.guest-btn\s*\{[\s\S]*?min-height: 42px;[\s\S]*?border-radius: var\(--radius-md\);/);
});

test('影棚选择器保留正式站视觉语言', () => {
    assert.match(styles, /\.studio-venue-picker\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*3px;[\s\S]*?width:\s*112px;/);
    assert.match(styles, /\.studio-venue-floor-row\s*\{[\s\S]*?padding:\s*1px;[\s\S]*?border:\s*1px solid #F2F4F7;[\s\S]*?background:\s*#FAFBFC;/);
    assert.match(styles, /\.studio-venue-options\s*\{[\s\S]*?gap:\s*1px;/);
    assert.match(styles, /\.studio-venue-option[\s\S]*border-radius: var\(--radius-xs\)/);
    assert.match(styles, /\.studio-venue-floor-row \.studio-venue-option\.active\s*\{[\s\S]*?background:\s*#FFFFFF;[\s\S]*?color:\s*var\(--accent-ink\);[\s\S]*?box-shadow:\s*0 1px 1px rgba\(15, 23, 42, 0\.025\);/);
    assert.match(styles, /\.studio-venue-category-row \.studio-venue-option\.active\s*\{[\s\S]*?color:\s*var\(--accent-ink\);[\s\S]*?box-shadow:\s*inset 0 -2px 0 var\(--accent-solid\);/);
});

test('用户菜单去掉外层圆角卡片', () => {
    const button = styles.match(
        /\.user-menu-button\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(button, '没有找到用户菜单按钮样式');
    assert.match(button[1], /border:\s*0;/);
    assert.match(button[1], /background:\s*transparent;/);
    assert.doesNotMatch(button[1], /border-radius:/);
});

test('日期条只将已过期日期置灰，未来锁定日期保留正常颜色', () => {
    assert.match(appSource, /const isPast = date < getChinaDate\(\);/);

    const renderer = appSource.match(
        /function renderBookingDateSwitcher\(\)\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(renderer, '没有找到日期条渲染函数');
    assert.match(renderer[1], /if \(option\.isPast\) classes\.push\('is-past'\)/);
    assert.match(renderer[1], /if \(!option\.viewable\) classes\.push\('is-locked'\)/);
    assert.match(renderer[1], /option\.viewable \? '' : ' disabled'/);

    const locked = styles.match(
        /\.booking-date-item\.is-locked\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(locked, '没有找到不可选日期样式');
    assert.doesNotMatch(locked[1], /color\s*:/, '未来锁定日期不应被灰色文字覆盖');

    const past = styles.match(
        /\.booking-date-item\.is-past\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(past, '没有找到已过期日期样式');
    assert.match(past[1], /color:\s*#A8B0BB/);

    const pastDetail = styles.match(
        /\.booking-date-item\.is-past \.booking-date-detail\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(pastDetail, '没有找到已过期日期的数字样式');
    assert.match(pastDetail[1], /color:\s*#B6BDC7/);
});

test('过期日期保留灰色但可点击查看当天历史记录', () => {
    const toolbarDates = appSource.match(
        /function getToolbarDates\(\)\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(toolbarDates, '没有找到日期条数据函数');
    assert.match(toolbarDates[1], /const isPast = date < getChinaDate\(\);/);
    assert.match(
        toolbarDates[1],
        /viewable:\s*isPast \|\| selectable\.has\(date\) \|\| canBrowseAllBookingDates\(\)/
    );

    const selectDate = appSource.match(
        /async function selectBookingDate\(date\)\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(selectDate, '没有找到日期切换函数');
    assert.match(selectDate[1], /isViewableBookingDate\(date, options\)/);
    assert.match(selectDate[1], /await loadBookingHistoryForDate\(selectedDate\)/);

    const loadHistory = appSource.match(
        /async function loadBookingHistoryForDate\(date\)\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(loadHistory, '没有找到历史记录加载函数');
    assert.match(loadHistory[1], /\/api\/bookings\?from=\$\{dateOnly\}&to=\$\{dateOnly\}/);
    assert.match(loadHistory[1], /map\(normalizeBookingRecord\)/);
    assert.match(loadHistory[1], /loadedBookingHistoryDates\.add\(dateOnly\)/);

    const loadBookings = appSource.match(
        /async function loadBookings\(\{ includeHistory = bookingHistoryLoaded \} = \{\}\)\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(loadBookings, '没有找到预约数据加载函数');
    assert.match(loadBookings[1], /loadedBookingHistoryDates\.clear\(\);/);
    assert.match(loadBookings[1], /await loadBookingHistoryForDate\(selectedDate\)/);
});

test('7F 实景棚可以查看任意日期，但预约窗口仍只有今天和明天', () => {
    const browseAllDates = appSource.match(
        /function canBrowseAllBookingDates\(\)\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(browseAllDates, '没有找到可浏览全部日期的判断函数');
    assert.match(browseAllDates[1], /currentStudioFloor === '7F'/);
    assert.match(browseAllDates[1], /currentStudioCategory === 'real-scene'/);

    const viewableDate = appSource.match(
        /function isViewableBookingDate\(date, options\)\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(viewableDate, '没有找到日期可查看判断函数');
    assert.match(viewableDate[1], /canBrowseAllBookingDates\(\)/);
    assert.match(viewableDate[1], /isSelectableDate\(dateOnly, options\)/);

    assert.match(appSource, /function getActiveBookingWindowDays\(\)\s*\{[\s\S]*?'6F'[\s\S]*?EXTENDED_BOOKING_WINDOW_DAYS[\s\S]*?: DEFAULT_BOOKING_WINDOW_DAYS/);
});

test('日期条固定周一起始并支持左右按周浏览', () => {
    assert.match(html, /id="bookingDatePrevious"[\s\S]*?aria-label="上一周"[\s\S]*?aria-controls="bookingDateList"/);
    assert.match(html, /id="bookingDateNext"[\s\S]*?aria-label="下一周"[\s\S]*?aria-controls="bookingDateList"/);
    assert.match(appSource, /const BOOKING_DATE_PAGE_SIZE = 7;/);
    assert.match(appSource, /let bookingDateStripStart = null;/);
    assert.match(appSource, /function getMondayDate\(date = getChinaDate\(\)\)/);
    assert.match(appSource, /return shiftDate\(date, -\(\(weekday \+ 6\) % 7\)\)/);

    const toolbarDates = appSource.match(
        /function getToolbarDates\(\)\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(toolbarDates, '没有找到日期条数据函数');
    assert.match(toolbarDates[1], /length:\s*BOOKING_DATE_PAGE_SIZE/);
    assert.match(toolbarDates[1], /shiftDate\(bookingDateStripStart,\s*index\)/);
    assert.match(toolbarDates[1], /bookingDateStripStart = getMondayDate\(\)/);

    const moveDateStrip = appSource.match(
        /function moveBookingDateStrip\(weekOffset\)\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(moveDateStrip, '没有找到日期条翻周函数');
    assert.match(moveDateStrip[1], /weekOffset\s*\*\s*BOOKING_DATE_PAGE_SIZE/);
    assert.match(moveDateStrip[1], /renderBookingDateSwitcher\(\)/);

    assert.match(styles, /\.booking-date-switcher\s*\{\s*display:\s*flex;/);

    assert.match(styles, /\.booking-date-nav\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/);
});
