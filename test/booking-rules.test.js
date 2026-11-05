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

const SCENE_6F = '6F·书房景';        // 6F 实景棚，窗口 7 天
const STUDIO_7F = '书房景';           // 7F 实景棚，窗口 2 天
const CYCLORAMA_6F = '6F无影棚';      // 6F 无影棚，窗口 2 天

test('常规棚位只开放今天和明天', () => {
    assert.ok(rules.isValidBookingDate('2026-08-24', STUDIO_7F, NOON), '今天');
    assert.ok(rules.isValidBookingDate('2026-08-25', STUDIO_7F, NOON), '明天');
    assert.ok(!rules.isValidBookingDate('2026-08-23', STUDIO_7F, NOON), '昨天');
    assert.ok(!rules.isValidBookingDate('2026-08-26', STUDIO_7F, NOON), '后天');
    assert.ok(rules.isValidBookingDate('2026-08-24T00:00:00.000Z', STUDIO_7F, NOON), 'ISO 格式也认');
    // 不传 studio 时按最严格的窗口处理
    assert.ok(rules.isValidBookingDate('2026-08-25', undefined, NOON));
    assert.ok(!rules.isValidBookingDate('2026-08-26', undefined, NOON));
});

test('只有 6F 实景棚的预约窗口是 7 天', () => {
    assert.equal(rules.getBookingWindowDays(SCENE_6F), 7);
    assert.equal(rules.getBookingWindowDays(STUDIO_7F), 2);
    assert.equal(rules.getBookingWindowDays(CYCLORAMA_6F), 2, '6F 无影棚不在放宽名单里');
    assert.equal(rules.getBookingWindowDays('大无影棚1（工位对面）'), 2);
    assert.equal(rules.getBookingWindowDays(undefined), 2);
    assert.equal(rules.EXTENDED_WINDOW_STUDIO_IDS.length, 22);
});

test('6F 实景棚今天起 7 天都能约，第 8 天不行', () => {
    const dates = rules.getBookableDates(SCENE_6F, NOON);
    assert.equal(dates.length, 7);
    assert.deepEqual(dates, [
        '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27',
        '2026-08-28', '2026-08-29', '2026-08-30'
    ]);
    for (const date of dates) {
        assert.ok(rules.isValidBookingDate(date, SCENE_6F, NOON), `${date} 应可约`);
        // 同一天换成 7F 的棚就不行了
        if (date > '2026-08-25') {
            assert.ok(!rules.isValidBookingDate(date, STUDIO_7F, NOON), `${date} 对 7F 不该可约`);
        }
    }
    assert.ok(!rules.isValidBookingDate('2026-08-31', SCENE_6F, NOON), '第 8 天超窗口');
    assert.ok(!rules.isValidBookingDate('2026-08-23', SCENE_6F, NOON), '昨天不能约');
});

test('6F 实景棚的窗口能跨月', () => {
    const dates = rules.getBookableDates(SCENE_6F, chinaTime(2026, 8, 28, 10));
    assert.deepEqual(dates, [
        '2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31',
        '2026-09-01', '2026-09-02', '2026-09-03'
    ]);
});

test('今天已经过去的开始时间不能再预约，明天不受限制', () => {
    assert.ok(!rules.isBookingStartAvailable('2026-08-24', '11:00', NOON), '已过去');
    assert.ok(!rules.isBookingStartAvailable('2026-08-24', '12:00', NOON), '正好是当前时间也算过去');
    assert.ok(rules.isBookingStartAvailable('2026-08-24', '12:15', NOON), '还没到');
    assert.ok(rules.isBookingStartAvailable('2026-08-25', '08:30', NOON), '明天的任何时段都可以');
});

test('今天未结束的预约和明天后天的预约都可以改，已结束的不行', () => {
    const at = (date, startTime, endTime) => ({ date, startTime, endTime, studio: STUDIO_7F });
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


test('6F 实景棚窗口内的远期预约仍然可以修改和取消', () => {
    const at = (date, studio) => ({ date, studio, startTime: '09:00', endTime: '10:00' });
    // 第 5 天：6F 实景棚可改，同一天的 7F 棚位不可改
    assert.ok(rules.isBookingEditable(at('2026-08-28', SCENE_6F), NOON));
    assert.ok(!rules.isBookingEditable(at('2026-08-28', STUDIO_7F), NOON));
    // 窗口最后一天可改，超出就不行
    assert.ok(rules.isBookingEditable(at('2026-08-30', SCENE_6F), NOON));
    assert.ok(!rules.isBookingEditable(at('2026-08-31', SCENE_6F), NOON));
    // 昨天一律不可改
    assert.ok(!rules.isBookingEditable(at('2026-08-23', SCENE_6F), NOON));
    // 简易视频的后天预约仍然单独放行（棚位窗口只有 2 天）
    assert.ok(rules.isBookingEditable(at('2026-08-26', '大无影棚1（工位对面）'), NOON));
});

test('放宽窗口后日期条能装下全部可选日期', () => {
    const cases = [
        ['周一 6F实景', chinaTime(2026, 8, 24, 12), false, 7],
        ['周三 6F实景', chinaTime(2026, 8, 26, 12), false, 7],
        ['周日 6F实景', chinaTime(2026, 8, 30, 12), false, 7],
        ['周一 6F实景 管理员', chinaTime(2026, 8, 24, 12), true, 7],
        ['周日 6F实景 管理员', chinaTime(2026, 8, 30, 12), true, 7],
        ['其他视图', chinaTime(2026, 8, 26, 12), false, 2]
    ];
    for (const [name, now, isAdmin, windowDays] of cases) {
        const strip = rules.getVisibleWeekDates({ isAdmin, windowDays, now });
        assert.ok(strip.length >= 7, `${name}: 至少 7 格`);
        for (let i = 1; i < strip.length; i += 1) {
            assert.equal(strip[i], rules.shiftDate(strip[i - 1], 1), `${name}: 日期必须连续`);
        }
        for (const item of rules.getSelectableDates({ isAdmin, windowDays, now })) {
            assert.ok(strip.includes(item.date), `${name}: ${item.date}(${item.label}) 必须在日期条里`);
        }
        assert.ok(strip.includes(rules.getChinaDate(0, now)), `${name}: 今天必须在日期条里`);
    }
});

test('6F 实景棚日期条第三天起用星期几做标签', () => {
    const dates = rules.getSelectableDates({ windowDays: 7, now: NOON });
    assert.equal(dates.length, 7);
    assert.deepEqual(dates.slice(0, 2).map(d => d.label), ['今天', '明天']);
    assert.deepEqual(dates.slice(2).map(d => d.label), ['周三', '周四', '周五', '周六', '周日']);
});

test('7F 实景棚 2026-11-05 下午培训停约，上午和其他棚位不受影响', () => {
    // 下午时段被拒绝
    assert.ok(rules.getStudioClosure('小木屋景', '2026-11-05', '14:00', '15:00'));
    assert.ok(rules.isStudioClosedAt('黑色台面-厨房景', '2026-11-05', '17:00', '18:30'));
    // 跨进停约时段也被拒绝（半开区间）
    assert.ok(rules.isStudioClosedAt('卧室景', '2026-11-05T00:00:00.000Z', '14:00', '14:15'));
    // 上午正常
    assert.equal(rules.getStudioClosure('小木屋景', '2026-11-05', '08:30', '12:30'), null);
    // 无影棚和 6F 实景棚不受影响
    assert.equal(rules.getStudioClosure('大无影棚1（工位对面）', '2026-11-05', '14:00', '18:30'), null);
    assert.equal(rules.getStudioClosure('6F·卧室景', '2026-11-05', '14:00', '18:30'), null);
    // 第二天自动恢复
    assert.equal(rules.getStudioClosure('小木屋景', '2026-11-06', '14:00', '18:30'), null);
    assert.deepEqual(rules.getStudioClosuresForDate('小木屋景', '2026-11-06'), []);
    assert.equal(rules.getStudioClosuresForDate('小木屋景', '2026-11-05').length, 1);
});
