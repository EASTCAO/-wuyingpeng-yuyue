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

    // 常规预约只开放今天和明天；后天仅对简易视频待办单独放行。
    function isValidBookingDate(date, now = Date.now()) {
        const day = getDateOnly(date);
        return day === getChinaDate(0, now) || day === getChinaDate(1, now);
    }

    function isBookingStartAvailable(date, startTime, now = Date.now()) {
        return getDateOnly(date) !== getChinaDate(0, now) || startTime > getChinaCurrentTime(now);
    }

    // 明天和后天的预约随时可改；今天的预约只要还没结束就能改。
    function isBookingEditable(booking, now = Date.now()) {
        if (!booking) return false;
        const day = getDateOnly(booking.date);
        if (day === getChinaDate(1, now) || day === getChinaDate(2, now)) return true;
        return day === getChinaDate(0, now) && booking.endTime > getChinaCurrentTime(now);
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
        isValidBookingDate,
        isBookingStartAvailable,
        isBookingEditable,
        getBookingStatus,
        getBookedSlotPercentage
    };
});
