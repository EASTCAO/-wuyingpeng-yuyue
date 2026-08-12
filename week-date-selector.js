(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.WeekDateSelector = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function parseDate(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day));
    }

    function formatDate(date) {
        return date.toISOString().slice(0, 10);
    }

    function shiftDate(dateString, offsetDays) {
        const date = parseDate(dateString);
        date.setUTCDate(date.getUTCDate() + offsetDays);
        return formatDate(date);
    }

    function getWeekDates(dateString) {
        const date = parseDate(dateString);
        const mondayOffset = (date.getUTCDay() + 6) % 7;
        const monday = shiftDate(dateString, -mondayOffset);
        return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
    }

    function weekIntersectsRange(dateString, minimumDate, maximumDate) {
        return getWeekDates(dateString).some(date => date >= minimumDate && date <= maximumDate);
    }

    return { shiftDate, getWeekDates, weekIntersectsRange };
});
