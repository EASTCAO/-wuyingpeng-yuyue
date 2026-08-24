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

test('可选日期只有今天和明天，管理员多一个昨天', () => {
    const photographer = rules.getSelectableDates({ now: NOON });
    assert.deepEqual(photographer.map(item => item.date), ['2026-08-24', '2026-08-25']);
    assert.deepEqual(photographer.map(item => item.label), ['今天', '明天']);

    const admin = rules.getSelectableDates({ isAdmin: true, now: NOON });
    assert.deepEqual(admin.map(item => item.date), ['2026-08-23', '2026-08-24', '2026-08-25']);
    assert.deepEqual(admin.map(item => item.label), ['昨天', '今天', '明天']);
    assert.equal(admin[0].offset, -1, '昨天排在最前面');
});

test('可选日期与"能不能预约"是两条独立规则', () => {
    // 管理员能查看昨天，但昨天依然不可预约。
    assert.ok(rules.isSelectableDate('2026-08-23', { isAdmin: true, now: NOON }));
    assert.ok(!rules.isValidBookingDate('2026-08-23', NOON));

    assert.ok(!rules.isSelectableDate('2026-08-23', { now: NOON }), '普通用户看不到昨天');
    assert.ok(!rules.isSelectableDate('2026-08-26', { isAdmin: true, now: NOON }), '后天不在切换器里');
});

test('可选日期跨月跨年都连续', () => {
    const acrossMonth = rules.getSelectableDates({ isAdmin: true, now: chinaTime(2026, 8, 31, 10) });
    assert.deepEqual(acrossMonth.map(item => item.date), ['2026-08-30', '2026-08-31', '2026-09-01']);

    const acrossYear = rules.getSelectableDates({ isAdmin: true, now: chinaTime(2026, 12, 31, 10) });
    assert.deepEqual(acrossYear.map(item => item.date), ['2026-12-30', '2026-12-31', '2027-01-01']);
});

test('星期几只由日期字符串决定，不受运行环境时区影响', () => {
    assert.equal(rules.getWeekdayLabel('2026-08-24'), '周一');
    assert.equal(rules.getWeekdayLabel('2026-08-25'), '周二');
    assert.equal(rules.getWeekdayLabel('2026-08-29'), '周六');
    assert.equal(rules.getWeekdayLabel('2026-08-30'), '周日');
    assert.equal(rules.getWeekdayLabel('2026-08-24T16:00:00.000Z'), '周一', 'ISO 时间戳也只看日期部分');
});

test('时段条按 30 分钟切格，上午 8 格下午 9 格，午休不算格子', () => {
    const timeline = rules.getDayTimeline([], '2026-08-25', { now: NOON });
    assert.equal(timeline.length, 2, '上午和下午两段');
    assert.equal(timeline[0].cells.length, 8, '08:30-12:30 共 8 个半小时');
    assert.equal(timeline[1].cells.length, 9, '14:00-18:30 共 9 个半小时');
    assert.equal(timeline[0].cells[0].start, '08:30');
    assert.equal(timeline[0].cells[7].end, '12:30');
    assert.equal(timeline[1].cells[0].start, '14:00');
    assert.equal(timeline[1].cells[8].end, '18:30');
    // 未来日期全部空闲
    assert.ok(timeline.every(p => p.cells.every(c => c.state === 'free')));
});

test('预约会把重叠到的格子标成已占，哪怕只占了一部分', () => {
    const bookings = [
        { date: '2026-08-25', startTime: '08:30', endTime: '10:30' },
        { date: '2026-08-25', startTime: '15:00', endTime: '15:15' }
    ];
    const timeline = rules.getDayTimeline(bookings, '2026-08-25', { now: NOON });
    const morning = timeline[0].cells.map(c => c.state);
    assert.deepEqual(morning.slice(0, 4), ['booked', 'booked', 'booked', 'booked'], '08:30-10:30 占 4 格');
    assert.deepEqual(morning.slice(4), ['free', 'free', 'free', 'free']);

    // 15:00-15:15 只占了 15 分钟，但整格 15:00-15:30 都算已占（概览宁可保守）
    const afternoon = timeline[1].cells.map(c => c.state);
    assert.equal(afternoon[2], 'booked');
    assert.equal(afternoon[3], 'free');
});

test('时段条区分"空闲"和"今天已经过去"', () => {
    const timeline = rules.getDayTimeline([], '2026-08-24', { now: NOON });
    const morning = timeline[0].cells;
    // 中午 12:00：结束时间 <= 12:00 的格子都算过去
    assert.ok(morning.slice(0, 7).every(c => c.state === 'past'), '08:30-12:00 都已过去');
    assert.equal(morning[7].state, 'free', '12:00-12:30 还没结束');
    assert.ok(timeline[1].cells.every(c => c.state === 'free'), '下午还没开始');

    // 明天不会有 past
    const tomorrow = rules.getDayTimeline([], '2026-08-25', { now: NOON });
    assert.ok(tomorrow.every(p => p.cells.every(c => c.state !== 'past')));

    // 昨天全是 past
    const yesterday = rules.getDayTimeline([], '2026-08-23', { now: NOON });
    assert.ok(yesterday.every(p => p.cells.every(c => c.state === 'past')));
});

test('时段条只统计当天的预约', () => {
    const bookings = [{ date: '2026-08-24', startTime: '08:30', endTime: '12:30' }];
    const timeline = rules.getDayTimeline(bookings, '2026-08-25', { now: NOON });
    assert.ok(timeline[0].cells.every(c => c.state === 'free'), '别的日期的预约不该占格');
});

test('时段条能压成一句给读屏用的话', () => {
    const empty = rules.getDayTimeline([], '2026-08-25', { now: NOON });
    assert.equal(rules.describeDayTimeline(empty), '上午全天可约，下午全天可约');

    const full = rules.getDayTimeline(
        [{ date: '2026-08-25', startTime: '08:30', endTime: '12:30' },
         { date: '2026-08-25', startTime: '14:00', endTime: '18:30' }],
        '2026-08-25', { now: NOON }
    );
    assert.equal(rules.describeDayTimeline(full), '上午无可约时段，下午无可约时段');

    const partial = rules.getDayTimeline(
        [{ date: '2026-08-25', startTime: '08:30', endTime: '10:30' }],
        '2026-08-25', { now: NOON }
    );
    assert.match(rules.describeDayTimeline(partial), /^上午剩 4 个时段可约，最早 10:30，下午全天可约$/);
});

test('日期条展示整周 7 天', () => {
    const week = rules.getVisibleWeekDates({ now: NOON });
    assert.equal(week.length, 7);
    // 2026-08-24 是周一，正常情况就是周一到周日
    assert.deepEqual(week, [
        '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27',
        '2026-08-28', '2026-08-29', '2026-08-30'
    ]);
    assert.deepEqual(week.map(rules.getWeekdayLabel),
        ['周一', '周二', '周三', '周四', '周五', '周六', '周日']);
});

test('可选日期跨周时窗口整体平移，保证每个可选日期都在窗口内', () => {
    const cases = [
        ['周三', chinaTime(2026, 8, 26, 12), false],
        ['周六', chinaTime(2026, 8, 29, 12), false],
        ['周日（明天是下周一）', chinaTime(2026, 8, 30, 12), false],
        ['周一管理员（昨天是上周日）', chinaTime(2026, 8, 24, 12), true],
        ['周日管理员', chinaTime(2026, 8, 30, 12), true],
        ['跨月周一', chinaTime(2026, 8, 31, 12), false],
        ['跨年', chinaTime(2026, 12, 31, 12), true]
    ];
    for (const [name, now, isAdmin] of cases) {
        const week = rules.getVisibleWeekDates({ isAdmin, now });
        assert.equal(week.length, 7, `${name}: 始终 7 天`);
        // 连续 7 天，不跳日
        for (let i = 1; i < week.length; i += 1) {
            assert.equal(week[i], rules.shiftDate(week[i - 1], 1), `${name}: 第 ${i} 天必须连续`);
        }
        // 所有可选日期都必须点得到
        for (const item of rules.getSelectableDates({ isAdmin, now })) {
            assert.ok(week.includes(item.date), `${name}: 可选日期 ${item.date}(${item.label}) 必须在窗口内`);
        }
        assert.ok(week.includes(rules.getChinaDate(0, now)), `${name}: 今天必须在窗口内`);
    }
});

test('周二到周六这些常规日子，窗口就是标准的周一到周日', () => {
    for (const day of [25, 26, 27, 28, 29]) {
        const week = rules.getVisibleWeekDates({ now: chinaTime(2026, 8, day, 12) });
        assert.equal(rules.getWeekdayLabel(week[0]), '周一', `8.${day} 应从周一开始`);
        assert.equal(rules.getWeekdayLabel(week[6]), '周日', `8.${day} 应到周日结束`);
    }
});

test('shiftDate 是纯日期加减，能跨月跨年', () => {
    assert.equal(rules.shiftDate('2026-08-24', 1), '2026-08-25');
    assert.equal(rules.shiftDate('2026-08-31', 1), '2026-09-01');
    assert.equal(rules.shiftDate('2026-09-01', -1), '2026-08-31');
    assert.equal(rules.shiftDate('2026-12-31', 1), '2027-01-01');
    assert.equal(rules.shiftDate('2027-01-01', -1), '2026-12-31');
    assert.equal(rules.shiftDate('2026-02-28', 1), '2026-03-01', '2026 不是闰年');
    assert.equal(rules.shiftDate('2026-08-24', 0), '2026-08-24');
});
