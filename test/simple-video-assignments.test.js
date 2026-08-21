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

test('切换账号后重置到预约首页且无权限用户不能停留在简易视频待办', () => {
    const logoutSource = appSource.slice(
        appSource.indexOf('function logout()'),
        appSource.indexOf('// 显示主页面')
    );
    const mainPageSource = appSource.slice(
        appSource.indexOf('function showMainPage()'),
        appSource.indexOf('function isSimpleVideoEligibleStudio')
    );
    const switchViewSource = appSource.slice(
        appSource.indexOf('async function switchView(view)'),
        appSource.indexOf('// 渲染时间轴')
    );

    assert.match(logoutSource, /simpleVideoTasks = \[\];[\s\S]*currentView = 'list';/);
    assert.match(mainPageSource, /simpleVideoTasks = \[\];[\s\S]*currentView = 'list';[\s\S]*switchView\('list'\);/);
    assert.match(switchViewSource, /if \(view === 'simple-video' && !isSimpleVideoRecipient\(\)\) \{[\s\S]*view = 'list';[\s\S]*\}[\s\S]*currentView = view;/);
});

test('今天和明天的摄影预约分别生成明天和后天的简易视频待办', () => {
    assert.match(appSource, /isSimpleVideoEligibleStudio\(studioSelect\.value\) && isBookableDate\(dateInput\.value\)/);
    assert.match(serverSource, /isValidBookingDate\(date\) && req\.body\?\.needsSimpleVideo === true/g);
    assert.match(serverSource, /date IN \(\$1, \$3\)/);
    assert.match(serverSource, /CASE WHEN bookings\.date = \$1 THEN \$3 ELSE \$6 END AS "simpleVideoTargetDate"/);
    assert.match(appSource, /getDateOnly\(booking\.date\) === getChinaDate\(\)[\s\S]*getChinaDate\(1\)[\s\S]*getChinaDate\(2\)/);
    assert.match(appSource, /openSimpleVideoBooking\(taskId, targetDate\)/);
    assert.match(appSource, /formatShortDate\(task\.simpleVideoTargetDate\).*需要预约无影棚/);
});

test('后天预约仅对本人绑定的简易视频待办开放', () => {
    assert.match(serverSource, /async function isAuthorizedSimpleVideoBooking\(user, taskId, date, studio\)/);
    assert.match(serverSource, /date !== getChinaDate\(2\)/);
    assert.match(serverSource, /SIMPLE_VIDEO_ASSIGNMENTS\[task\.photographer\] === user\.username/);
    assert.match(serverSource, /await isAuthorizedSimpleVideoBooking\(req\.user, simpleVideoTaskId, date, studio\)/);
    assert.match(appSource, /showAddBookingForm\(undefined, null, \{ taskId, targetDate \}\)/);
    assert.match(appSource, /const minDate = simpleVideoBookingContext\?\.targetDate \|\| getBookableStartDate\(\);/);
    assert.match(appSource, /simpleVideoTaskId: simpleVideoBookingContext\?\.taskId \|\| ''/);
});

test('简易视频人员刷新后仍能查看、修改和取消后天预约', () => {
    assert.match(appSource, /getChinaDate\(isSimpleVideoRecipient\(\) \? 2 : 1\)/);
    assert.match(appSource, /bookingDate === getChinaDate\(1\) \|\| bookingDate === getChinaDate\(2\)/);
    assert.match(serverSource, /booking\.date === getChinaDate\(1\) \|\| booking\.date === getChinaDate\(2\)/);
    assert.match(serverSource, /booking\.date === getChinaDate\(2\) && date === getChinaDate\(2\)/);
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

test('简易视频待办只用文字区分已预约与待预约并保持卡片原色', () => {
    const styles = fs.readFileSync('style.css', 'utf8');
    assert.match(appSource, /simple-video-task-card \$\{booking\.simpleVideoCompleted \? 'is-booked' : 'is-pending'\}/);
    assert.match(appSource, /simple-video-task-status">\$\{booking\.simpleVideoCompleted \? '已预约' : '待预约'\}/);
    assert.match(styles, /\.simple-video-task-card\s*\{[\s\S]*border-left: 4px solid #4c7dff;[\s\S]*background: #fff;/);
    assert.doesNotMatch(styles, /\.simple-video-task-card\.is-(?:booked|pending)\s*\{/);
});
