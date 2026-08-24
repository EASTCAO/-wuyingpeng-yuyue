// 预约规则的行为测试：直接调用 shared/booking-rules.js 里的真函数，
// 不做源码正则匹配。所有依赖"现在"的函数都接受显式的 now 参数，因此结果完全确定。
const assert = require('node:assert/strict');
const test = require('node:test');

const rules = require('../shared/booking-rules');

// 构造一个"中国时区的某年某月某日某时某分"对应的时间戳。中国固定 UTC+8，无夏令时。
function chinaTime(year, month, day, hour = 0, minute = 0) {
    return Date.UTC(year, month - 1, day, hour - 8, minute);
}

const NOON = chinaTime(2026, 8, 24, 12, 0);

test('时间与分钟数可以无损互相转换', () => {
    assert.equal(rules.timeToMinutes('00:00'), 0);
    assert.equal(rules.timeToMinutes('08:30'), 510);
    assert.equal(rules.timeToMinutes('18:30'), 1110);
    assert.equal(rules.minutesToTime(0), '00:00');
    assert.equal(rules.minutesToTime(510), '08:30');
    assert.equal(rules.minutesToTime(1110), '18:30');

    for (let minutes = 0; minutes < 1440; minutes += 15) {
        assert.equal(rules.timeToMinutes(rules.minutesToTime(minutes)), minutes);
    }
});

test('getDateOnly 能同时处理纯日期和 ISO 时间戳', () => {
    assert.equal(rules.getDateOnly('2026-08-24'), '2026-08-24');
    assert.equal(rules.getDateOnly('2026-08-24T03:00:00.000Z'), '2026-08-24');
    assert.equal(rules.getDateOnly(''), '');
    assert.equal(rules.getDateOnly(null), '');
    assert.equal(rules.getDateOnly(undefined), '');
});

test('营业时段只认上午和下午两段，午休时间不属于任何时段', () => {
    assert.deepEqual(rules.getBookablePeriod('08:30'), { start: '08:30', end: '12:30' });
    assert.deepEqual(rules.getBookablePeriod('12:30'), { start: '08:30', end: '12:30' });
    assert.deepEqual(rules.getBookablePeriod('14:00'), { start: '14:00', end: '18:30' });
    assert.deepEqual(rules.getBookablePeriod('18:30'), { start: '14:00', end: '18:30' });
    assert.equal(rules.getBookablePeriod('13:00'), null);
    assert.equal(rules.getBookablePeriod('08:00'), null);
    assert.equal(rules.getBookablePeriod('19:00'), null);
});

test('可选开始时间覆盖两个时段且不含时段末尾', () => {
    const startTimes = rules.getBookingStartTimes();
    // 上午 08:30-12:30 共 16 格，下午 14:00-18:30 共 18 格。
    assert.equal(startTimes.length, 34);
    assert.equal(startTimes[0], '08:30');
    assert.ok(!startTimes.includes('12:30'), '12:30 只能当结束时间');
    assert.ok(startTimes.includes('12:15'));
    assert.ok(startTimes.includes('14:00'));
    assert.ok(!startTimes.includes('18:30'), '18:30 只能当结束时间');
    assert.ok(!startTimes.includes('13:00'), '午休不可预约');
});

test('合法预约时段：同一时段内、15 分钟对齐、开始早于结束', () => {
    assert.ok(rules.isValidBookingRange('08:30', '09:00'));
    assert.ok(rules.isValidBookingRange('08:30', '12:30'));
    assert.ok(rules.isValidBookingRange('14:00', '18:30'));
    assert.ok(rules.isValidBookingRange('10:15', '10:30'));
});

test('非法预约时段一律拒绝', () => {
    assert.ok(!rules.isValidBookingRange('12:00', '14:30'), '不能跨越午休');
    assert.ok(!rules.isValidBookingRange('08:30', '08:40'), '必须 15 分钟对齐');
    assert.ok(!rules.isValidBookingRange('08:35', '09:05'), '开始时间必须落在网格上');
    assert.ok(!rules.isValidBookingRange('10:00', '09:00'), '结束不能早于开始');
    assert.ok(!rules.isValidBookingRange('10:00', '10:00'), '时长不能为零');
    assert.ok(!rules.isValidBookingRange('08:00', '09:00'), '早于营业时间');
    assert.ok(!rules.isValidBookingRange('18:00', '19:00'), '晚于营业时间');
    assert.ok(!rules.isValidBookingRange('13:00', '13:30'), '午休时间不可预约');
    assert.ok(!rules.isValidBookingRange('9:00', '10:00'), '必须是两位数小时');
    assert.ok(!rules.isValidBookingRange('25:00', '26:00'), '非法小时');
    assert.ok(!rules.isValidBookingRange('', ''), '空值');
    assert.ok(!rules.isValidBookingRange(null, undefined), '空值');
});

test('时间冲突判断使用半开区间，首尾相接不算冲突', () => {
    assert.ok(!rules.hasTimeOverlap('09:00', '10:00', '10:00', '11:00'), '前后相接不冲突');
    assert.ok(!rules.hasTimeOverlap('10:00', '11:00', '09:00', '10:00'), '前后相接不冲突');
    assert.ok(rules.hasTimeOverlap('09:00', '10:00', '09:30', '10:30'), '部分重叠');
    assert.ok(rules.hasTimeOverlap('09:00', '12:00', '10:00', '11:00'), '完全包含');
    assert.ok(rules.hasTimeOverlap('10:00', '11:00', '09:00', '12:00'), '被完全包含');
    assert.ok(rules.hasTimeOverlap('09:00', '10:00', '09:00', '10:00'), '完全相同');
    assert.ok(!rules.hasTimeOverlap('09:00', '10:00', '14:00', '15:00'), '完全错开');
});

test('日期一律按上海时区计算，不受服务器时区影响', () => {
    // UTC 2026-08-23 16:30 = 中国 2026-08-24 00:30，日期必须算成 24 号。
    const justAfterMidnight = Date.UTC(2026, 7, 23, 16, 30);
    assert.equal(rules.getChinaDate(0, justAfterMidnight), '2026-08-24');
    assert.equal(rules.getChinaCurrentTime(justAfterMidnight), '00:30');

    // UTC 2026-08-23 15:30 = 中国 2026-08-23 23:30，还是 23 号。
    const justBeforeMidnight = Date.UTC(2026, 7, 23, 15, 30);
    assert.equal(rules.getChinaDate(0, justBeforeMidnight), '2026-08-23');
    assert.equal(rules.getChinaCurrentTime(justBeforeMidnight), '23:30');
});

test('日期偏移能正确跨月和跨年', () => {
    assert.equal(rules.getChinaDate(1, chinaTime(2026, 8, 31, 10)), '2026-09-01');
    assert.equal(rules.getChinaDate(-1, chinaTime(2026, 9, 1, 10)), '2026-08-31');
    assert.equal(rules.getChinaDate(1, chinaTime(2026, 12, 31, 10)), '2027-01-01');
    assert.equal(rules.getChinaDate(2, chinaTime(2026, 2, 27, 10)), '2026-03-01', '2026 不是闰年');
});

test('常规预约只开放今天和明天', () => {
    assert.ok(rules.isValidBookingDate('2026-08-24', NOON), '今天');
    assert.ok(rules.isValidBookingDate('2026-08-25', NOON), '明天');
    assert.ok(!rules.isValidBookingDate('2026-08-23', NOON), '昨天');
    assert.ok(!rules.isValidBookingDate('2026-08-26', NOON), '后天');
    assert.ok(rules.isValidBookingDate('2026-08-24T00:00:00.000Z', NOON), 'ISO 格式也认');
});

test('今天已经过去的开始时间不能再预约，明天不受限制', () => {
    assert.ok(!rules.isBookingStartAvailable('2026-08-24', '11:00', NOON), '已过去');
    assert.ok(!rules.isBookingStartAvailable('2026-08-24', '12:00', NOON), '正好是当前时间也算过去');
    assert.ok(rules.isBookingStartAvailable('2026-08-24', '12:15', NOON), '还没到');
    assert.ok(rules.isBookingStartAvailable('2026-08-25', '08:30', NOON), '明天的任何时段都可以');
});

test('今天未结束的预约和明天后天的预约都可以改，已结束的不行', () => {
    const at = (date, startTime, endTime) => ({ date, startTime, endTime });
    assert.ok(!rules.isBookingEditable(at('2026-08-24', '09:00', '11:00'), NOON), '今天已结束');
    assert.ok(!rules.isBookingEditable(at('2026-08-24', '11:00', '12:00'), NOON), '刚好结束');
    assert.ok(rules.isBookingEditable(at('2026-08-24', '11:00', '12:15'), NOON), '今天进行中');
    assert.ok(rules.isBookingEditable(at('2026-08-24', '15:00', '16:00'), NOON), '今天还没开始');
    assert.ok(rules.isBookingEditable(at('2026-08-25', '09:00', '10:00'), NOON), '明天');
    assert.ok(rules.isBookingEditable(at('2026-08-26', '09:00', '10:00'), NOON), '后天（简易视频）');
    assert.ok(!rules.isBookingEditable(at('2026-08-23', '09:00', '10:00'), NOON), '昨天');
    assert.ok(!rules.isBookingEditable(at('2026-08-27', '09:00', '10:00'), NOON), '大后天');
    assert.ok(!rules.isBookingEditable(null, NOON));
});

test('预约状态按上海时区在未开始、进行中、已结束之间切换', () => {
    const at = (date, startTime, endTime) => ({ date, startTime, endTime });
    assert.equal(rules.getBookingStatus(at('2026-08-23', '09:00', '10:00'), NOON), 'completed');
    assert.equal(rules.getBookingStatus(at('2026-08-25', '09:00', '10:00'), NOON), 'upcoming');
    assert.equal(rules.getBookingStatus(at('2026-08-24', '09:00', '11:00'), NOON), 'completed');
    assert.equal(rules.getBookingStatus(at('2026-08-24', '09:00', '12:00'), NOON), 'completed', '结束时间等于现在算已结束');
    assert.equal(rules.getBookingStatus(at('2026-08-24', '11:00', '12:15'), NOON), 'ongoing');
    assert.equal(rules.getBookingStatus(at('2026-08-24', '12:00', '12:30'), NOON), 'ongoing', '开始时间等于现在算进行中');
    assert.equal(rules.getBookingStatus(at('2026-08-24', '14:00', '15:00'), NOON), 'upcoming');
});

test('占用百分比按 15 分钟格子计算', () => {
    const dates = ['2026-08-24'];
    assert.equal(rules.getBookedSlotPercentage([], dates), 0);

    const morning = { date: '2026-08-24', startTime: '08:30', endTime: '12:30' };
    const afternoon = { date: '2026-08-24', startTime: '14:00', endTime: '18:30' };
    assert.equal(rules.getBookedSlotPercentage([morning, afternoon], dates), 100);

    // 上午 16 格 / 全天 34 格
    assert.equal(rules.getBookedSlotPercentage([morning], dates), Math.round(16 / 34 * 100));

    // 别的日期的预约不计入
    const otherDay = { date: '2026-08-25', startTime: '08:30', endTime: '12:30' };
    assert.equal(rules.getBookedSlotPercentage([otherDay], dates), 0);

    // 两天里只订满一天 = 50%
    assert.equal(
        rules.getBookedSlotPercentage([morning, afternoon], ['2026-08-24', '2026-08-25']),
        50
    );
});

test('日期字符串格式校验只接受 YYYY-MM-DD', () => {
    assert.ok(rules.isValidDateString('2026-08-24'));
    assert.ok(!rules.isValidDateString('2026-8-24'));
    assert.ok(!rules.isValidDateString('2026/08/24'));
    assert.ok(!rules.isValidDateString(''));
    assert.ok(!rules.isValidDateString(null));
    assert.ok(!rules.isValidDateString("2026-08-24' OR 1=1"));
});

test('营业时段常量是冻结的，不会被调用方意外改掉', () => {
    assert.ok(Object.isFrozen(rules.BOOKABLE_PERIODS));
    assert.ok(Object.isFrozen(rules.BOOKABLE_PERIODS[0]));

    // 非严格模式下写冻结对象是静默失败，所以直接断言"改不动"。
    try { rules.BOOKABLE_PERIODS[0].start = '00:00'; } catch { /* 严格模式下会抛，也可以 */ }
    assert.equal(rules.BOOKABLE_PERIODS.length, 2);
    assert.equal(rules.BOOKABLE_PERIODS[0].start, '08:30');
    assert.equal(rules.BOOKABLE_PERIODS[1].end, '18:30');
});
