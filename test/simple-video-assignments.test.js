const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const appSource = fs.readFileSync('app.js', 'utf8');
const serverSource = fs.readFileSync('api/server.js', 'utf8');

const assignments = [
    ['曹东', '涂萱'], ['於佳莹', '向芷琪'], ['夏驰', '李冬梅'],
    ['谭金林', '何雨涵'], ['杨丽', '魏钰涵'], ['卢圣林', '王羽'],
    ['鄢军', '曹玉'], ['吕文祎', '王思琪'], ['徐优', '程思盈'],
    ['周旭欣', '魏钰涵'], ['付国俊', '阮静'], ['沈磊', '王斐雯'],
    ['张阳洋', '魏钰涵']
];

test('前后端包含全部简易视频人员绑定', () => {
    assignments.forEach(([photographer, recipient]) => {
        const pattern = new RegExp(`'${photographer}': '${recipient}'`);
        assert.match(appSource, pattern);
        assert.match(serverSource, pattern);
    });
});

test('接收人只读取自己绑定人员的简易视频待办', () => {
    assert.match(appSource, /assignedPhotographers\.has\(booking\.photographer\)/);
    assert.match(serverSource, /photographer = ANY\(\$4::text\[\]\)/);
    assert.match(appSource, /el\.classList\.toggle\('hidden', !isSimpleVideoRecipient\(\)\);/);
});

test('今天和明天的预约都可以选择简易视频并生成正确日期的待办', () => {
    assert.match(appSource, /isSimpleVideoEligibleStudio\(studioSelect\.value\) && isBookableDate\(dateInput\.value\)/);
    assert.match(serverSource, /isValidBookingDate\(date\) && req\.body\?\.needsSimpleVideo === true/g);
    assert.match(serverSource, /date IN \(\$1, \$3\)/);
    assert.match(serverSource, /CASE WHEN bookings\.date = \$1 THEN \$3 ELSE bookings\.date END AS "simpleVideoTargetDate"/);
    assert.match(appSource, /openSimpleVideoBooking\(targetDate\)/);
});

test('只有对应日期的7F无影棚预约才算完成简易视频待办', () => {
    assert.match(appSource, /isSimpleVideoEligibleStudio\(ownerBooking\.studio\)/);
    assert.match(serverSource, /const SIMPLE_VIDEO_STUDIO_IDS = \[/);
    assert.match(serverSource, /owner_booking\.studio = ANY\(\$5::text\[\]\)/);
    assert.doesNotMatch(serverSource, /owner_booking\.studio <> '6F无影棚'/);
});

test('完成对应预约后未读消息自动变成已读', () => {
    assert.match(appSource, /const count = simpleVideoTasks\.filter\(task => !task\.simpleVideoCompleted\)\.length;/);
    assert.match(appSource, /simpleVideoCompleted: Boolean\(simpleVideoBooking\)/);
    assert.match(appSource, /badge\.classList\.toggle\('hidden', count === 0\)/);
});

test('已完成待办可以进入对应预约并取消', () => {
    assert.match(appSource, /simpleVideoBookingId: simpleVideoBooking\?\.id \|\| ''/);
    assert.match(serverSource, /AS "simpleVideoBookingId"/);
    assert.match(appSource, /查看\/取消预约<\/button>/);
    assert.match(appSource, /showBookingDetail\(\$\{inlineJsString\(booking\.simpleVideoBookingId\)\}\)/);
    assert.match(appSource, /if \(isSimpleVideoRecipient\(\)\) await loadSimpleVideoTasks\(\);/);
});

test('待办卡片只突出原预约时间、影棚位置和简易视频预约时间', () => {
    const renderSource = appSource.slice(
        appSource.indexOf('function renderSimpleVideoTasks()'),
        appSource.indexOf('function openSimpleVideoBooking')
    );
    assert.match(appSource, /原摄影师预约：\$\{escapeHtml\(formatDate\(booking\.date\)\)\} \$\{escapeHtml\(booking\.startTime\)\}-\$\{escapeHtml\(booking\.endTime\)\}/);
    assert.match(appSource, /影棚位置：\$\{escapeHtml\(booking\.studio\)\}/);
    assert.match(appSource, /简易视频预约：\$\{booking\.simpleVideoCompleted/);
    assert.match(appSource, /simpleVideoStartTime: simpleVideoBooking\?\.startTime \|\| ''/);
    assert.match(serverSource, /AS "simpleVideoStartTime"/);
    assert.match(serverSource, /AS "simpleVideoEndTime"/);
    assert.doesNotMatch(renderSource, /摄影师：/);
    assert.doesNotMatch(renderSource, /已读 · 已预约对应日期无影棚/);
});
