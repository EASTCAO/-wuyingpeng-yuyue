// 预约核心规则：前端 app.js / studio-layout.js 与后端 api/server.js 的唯一事实来源。
//
// 本文件既能被浏览器用 <script> 直接加载（导出到 globalThis），也能被 Node 用 require 加载。
// api/booking-rules.js 是本文件的自动同步副本（Zeabur 只以 ./api 为构建根目录，
// 后端无法 require 到仓库根目录的文件）。请只修改本文件，然后运行：
//
//     node scripts/sync-shared.js
//
// test/shared-rules-sync.test.js 会校验两份文件完全一致，忘记同步会直接测试失败。
(function (root, factory) {
    const bookingRules = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = bookingRules;
    } else {
        Object.assign(root, bookingRules);
        root.BookingRules = bookingRules;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const BOOKING_INTERVAL_MINUTES = 15;
    const BOOKING_START_TIME = '08:30';
    const BOOKING_END_TIME = '18:30';
    const BOOKABLE_PERIODS = Object.freeze([
        Object.freeze({ start: '08:30', end: '12:30' }),
        Object.freeze({ start: '14:00', end: '18:30' })
    ]);

    const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
    const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
    const MILLISECONDS_PER_DAY = 86400000;

    // Intl.DateTimeFormat 的构造是 Intl 里最贵的操作，而这两个函数会在每轮渲染中
    // 被调用几十次（每个棚位至少 2 次）。实例必须复用，不能每次 new。
    const CHINA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const CHINA_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    // now 参数只为测试提供确定性，业务代码一律省略。
    function getChinaDate(offsetDays = 0, now = Date.now()) {
        return CHINA_DATE_FORMATTER.format(new Date(now + offsetDays * MILLISECONDS_PER_DAY));
    }

    function getChinaCurrentTime(now = Date.now()) {
        return CHINA_TIME_FORMATTER.format(new Date(now));
    }

    function timeToMinutes(time) {
        const [hour, minute] = String(time).split(':').map(Number);
        return hour * 60 + minute;
    }

    function minutesToTime(minutes) {
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    // 后端返回的 date 可能是 ISO 时间戳，统一只取日期部分。
    function getDateOnly(dateStr) {
        if (!dateStr) return '';
        return String(dateStr).split('T')[0];
    }

    function isValidDateString(date) {
        return DATE_PATTERN.test(String(date || ''));
    }

    function getBookablePeriod(time) {
        return BOOKABLE_PERIODS.find(period => time >= period.start && time <= period.end) || null;
    }

    function getTimeOptions(startTime = BOOKING_START_TIME, endTime = BOOKING_END_TIME, step = BOOKING_INTERVAL_MINUTES) {
        const options = [];
        for (let minutes = timeToMinutes(startTime); minutes <= timeToMinutes(endTime); minutes += step) {
            options.push(minutesToTime(minutes));
        }
        return options;
    }

    // 所有营业时段内合法的开始时间（不含每个时段的最后一格，因为它只能当结束时间）。
    function getBookingStartTimes() {
        return BOOKABLE_PERIODS.flatMap(period => getTimeOptions(period.start, period.end).slice(0, -1));
    }

    function isValidBookingRange(startTime, endTime) {
        if (!TIME_PATTERN.test(String(startTime)) || !TIME_PATTERN.test(String(endTime))) return false;
        const period = getBookablePeriod(startTime);
        // 结束时间必须落在同一个营业时段内，禁止跨越午休。
        if (!period || getBookablePeriod(endTime) !== period) return false;
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);
        return startMinutes < endMinutes
            && (startMinutes - timeToMinutes(period.start)) % BOOKING_INTERVAL_MINUTES === 0
            && (endMinutes - timeToMinutes(period.start)) % BOOKING_INTERVAL_MINUTES === 0;
    }

    // 半开区间 [start, end) 相交判断，前后端所有冲突检测都走这里。
    function hasTimeOverlap(startA, endA, startB, endB) {
        return !(endA <= startB || startA >= endB);
    }

    // 6F 实景棚可以提前一周预约，其余棚位仍然只能约今天和明天。
    // 这份清单是预约规则的一部分，必须和 app.js / api/server.js 的棚位配置保持一致，
    // test/studio-config-consistency.test.js 会校验。
    const EXTENDED_WINDOW_STUDIO_IDS = Object.freeze([
        '6F·走廊景',
        '6F·木墙景',
        '6F·绿植背景墙景',
        '6F·绿植房景',
        '6F·儿童房景',
        '6F·教室景',
        '6F·医护室景',
        '6F·海洋背景墙景',
        '6F·书房景',
        '6F·复古餐厅景',
        '6F·现代客厅景',
        '6F·现代餐厅景',
        '6F·街道景',
        '6F·户外咖啡景',
        '6F·卧室景',
        '6F·洗浴室景',
        '6F·吧台景',
        '6F·国风景',
        '6F·工具间景',
        '6F·现代厨房景',
        '6F·茶水间',
        '5F·阳台景'
    ]);
    const EXTENDED_BOOKING_WINDOW_DAYS = 7;
    const DEFAULT_BOOKING_WINDOW_DAYS = 2;

    function getBookingWindowDays(studio) {
        return EXTENDED_WINDOW_STUDIO_IDS.includes(studio)
            ? EXTENDED_BOOKING_WINDOW_DAYS
            : DEFAULT_BOOKING_WINDOW_DAYS;
    }

    // 某个棚位当前能预约的全部日期，从今天算起。
    function getBookableDates(studio, now = Date.now()) {
        return Array.from(
            { length: getBookingWindowDays(studio) },
            (_, offset) => getChinaDate(offset, now)
        );
    }

    // studio 省略时按最严格的窗口（今天/明天）判断。
    function isValidBookingDate(date, studio, now = Date.now()) {
        return getBookableDates(studio, now).includes(getDateOnly(date));
    }

    function isBookingStartAvailable(date, startTime, now = Date.now()) {
        return getDateOnly(date) !== getChinaDate(0, now) || startTime > getChinaCurrentTime(now);
    }

    // 今天的预约只要还没结束就能改；未来的预约只要还在该棚位的预约窗口内就能改。
    // 简易视频的后天预约不在常规窗口里，单独放行。
    function isBookingEditable(booking, now = Date.now()) {
        if (!booking) return false;
        const day = getDateOnly(booking.date);
        const today = getChinaDate(0, now);
        if (day < today) return false;
        if (day === today) return booking.endTime > getChinaCurrentTime(now);
        return isValidBookingDate(day, booking.studio, now) || day === getChinaDate(2, now);
    }

    function getBookingStatus(booking, now = Date.now()) {
        const today = getChinaDate(0, now);
        const day = getDateOnly(booking.date);
        if (day < today) return 'completed';
        if (day > today) return 'upcoming';

        const currentMinutes = timeToMinutes(getChinaCurrentTime(now));
        if (timeToMinutes(booking.endTime) <= currentMinutes) return 'completed';
        if (timeToMinutes(booking.startTime) <= currentMinutes) return 'ongoing';
        return 'upcoming';
    }

    // bookings 必须是同一个棚位的预约；返回 dates 覆盖的时段中已被占用的百分比。
    function getBookedSlotPercentage(bookings, dates) {
        const startTimes = getBookingStartTimes();
        const totalSlots = startTimes.length * dates.length;
        if (totalSlots === 0 || bookings.length === 0) return 0;

        const bookedSlots = dates.reduce((total, date) => total + startTimes.filter(startTime => {
            const endTime = minutesToTime(timeToMinutes(startTime) + BOOKING_INTERVAL_MINUTES);
            return bookings.some(booking =>
                getDateOnly(booking.date) === date
                && hasTimeOverlap(startTime, endTime, booking.startTime, booking.endTime)
            );
        }).length, 0);

        return Math.round((bookedSlots / totalSlots) * 100);
    }

    // 顶部日期切换器实际可选的日期。
    // windowDays 由当前视图决定：6F 实景棚是 7 天，其余是今天/明天。
    // 管理员额外多一个昨天用于查看昨天的记录。
    function getSelectableDates({ isAdmin = false, windowDays = DEFAULT_BOOKING_WINDOW_DAYS, now = Date.now() } = {}) {
        const labels = ['今天', '明天'];
        const dates = Array.from({ length: windowDays }, (_, offset) => ({
            date: getChinaDate(offset, now),
            label: labels[offset] || getWeekdayLabel(getChinaDate(offset, now)),
            offset
        }));
        if (isAdmin) dates.unshift({ date: getChinaDate(-1, now), label: '昨天', offset: -1 });
        return dates;
    }

    function isSelectableDate(date, options) {
        return getSelectableDates(options).some(item => item.date === getDateOnly(date));
    }

    // 星期几，只依赖日期字符串本身，不受运行环境时区影响。
    function getWeekdayLabel(date) {
        const [year, month, day] = getDateOnly(date).split('-').map(Number);
        return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][
            new Date(Date.UTC(year, month - 1, day)).getUTCDay()
        ];
    }

    // 纯日期加减，不依赖"现在"。用 UTC 构造避免本地时区把日期算偏一天。
    function shiftDate(date, offsetDays) {
        const [year, month, day] = getDateOnly(date).split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10);
    }

    function countDaysBetween(from, to) {
        const parse = date => {
            const [year, month, day] = getDateOnly(date).split('-').map(Number);
            return Date.UTC(year, month - 1, day);
        };
        return Math.round((parse(to) - parse(from)) / MILLISECONDS_PER_DAY) + 1;
    }

    // 顶部日期条展示的日期。默认是今天所在的周一到周日。
    //
    // 边界一：周日时"明天"是下周一、管理员周一时"昨天"是上周日，都落在本周之外。
    // 严格按周一到周日切会让这些可选日期点不到，所以窗口整体平移到刚好装下它们。
    // 边界二：6F 实景棚的预约窗口是 7 天（管理员再加昨天就是 8 天），
    // 这时窗口长度也要跟着拉长，否则同样装不下。
    function getVisibleWeekDates({ isAdmin = false, windowDays = DEFAULT_BOOKING_WINDOW_DAYS, now = Date.now() } = {}) {
        const selectable = getSelectableDates({ isAdmin, windowDays, now }).map(item => item.date);
        const first = selectable[0];
        const last = selectable[selectable.length - 1];

        const today = getChinaDate(0, now);
        const [year, month, day] = today.split('-').map(Number);
        const mondayOffset = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;

        const span = Math.max(7, countDaysBetween(first, last));
        let start = shiftDate(today, -mondayOffset);
        if (first < start) start = first;
        if (last > shiftDate(start, span - 1)) start = shiftDate(last, -(span - 1));

        return Array.from({ length: span }, (_, index) => shiftDate(start, index));
    }

    return {
        BOOKING_INTERVAL_MINUTES,
        BOOKING_START_TIME,
        BOOKING_END_TIME,
        BOOKABLE_PERIODS,
        getChinaDate,
        getChinaCurrentTime,
        timeToMinutes,
        minutesToTime,
        getDateOnly,
        isValidDateString,
        getBookablePeriod,
        getTimeOptions,
        getBookingStartTimes,
        isValidBookingRange,
        hasTimeOverlap,
        EXTENDED_WINDOW_STUDIO_IDS,
        EXTENDED_BOOKING_WINDOW_DAYS,
        DEFAULT_BOOKING_WINDOW_DAYS,
        getBookingWindowDays,
        getBookableDates,
        isValidBookingDate,
        isBookingStartAvailable,
        isBookingEditable,
        getBookingStatus,
        getBookedSlotPercentage,
        getSelectableDates,
        isSelectableDate,
        getWeekdayLabel,
        shiftDate,
        getVisibleWeekDates
    };
});
