const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const appSource = fs.readFileSync('app.js', 'utf8');
const serverSource = fs.readFileSync('api/server.js', 'utf8');
const sharedRulesSource = fs.readFileSync('shared/booking-rules.js', 'utf8');
const indexSource = fs.readFileSync('index.html', 'utf8');

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
    assert.match(appSource, /!simpleVideoBookingContext[\s\S]*isSimpleVideoEligibleStudio\(studioSelect\.value\)[\s\S]*isBookableDate\(dateInput\.value, studioSelect\.value\)/);
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
    // 简易视频待办把可选日期锁死在摄影次日那一天（min 和 max 都是它）
    assert.match(appSource, /dateInput\.min = simpleVideoBookingContext\?\.targetDate \|\| getBookableStartDate\(\);/);
    assert.match(appSource, /dateInput\.max = simpleVideoBookingContext\?\.targetDate \|\| getBookableEndDate\(studio\);/);
    assert.match(appSource, /simpleVideoTaskId: simpleVideoBookingContext\?\.taskId \|\| ''/);
});

test('简易视频预约流程隐藏重复的简易视频开关', () => {
    assert.match(appSource, /const eligible = !isSimpleVideoRecipient\(\)[\s\S]*!simpleVideoBookingContext[\s\S]*isSimpleVideoEligibleStudio\(studioSelect\.value\)/);
    assert.match(appSource, /simpleVideoOption\?\.classList\.toggle\('hidden', !eligible\)/);
    assert.match(appSource, /simpleVideoHint\.textContent = eligible[\s\S]*生成简易视频待办/);
    assert.match(appSource, /simpleVideoCheckbox\.onchange = \(\) => updateSimpleVideoOption\(\{ syncValue: false \}\)/);
    assert.match(indexSource, /booking-addon-card simple-video-booking-option hidden/);
});

test('摄影师可在预约表单填写并保存备注', () => {
    assert.match(indexSource, /<label for="bookingNote">备注<\/label>/);
    assert.match(indexSource, /<textarea id="bookingNote"[\s\S]*aria-describedby="bookingNoteHint">/);
    assert.match(appSource, /document\.getElementById\('bookingNote'\)\.value = bookingToEdit \? getBookingNote\(bookingToEdit\) : '';/);
    assert.match(appSource, /const note = document\.getElementById\('bookingNote'\)\.value\.trim\(\);/);
});

test('简易视频人员刷新后仍能查看、修改和取消后天预约', () => {
    // 数据拉取范围要盖住简易视频的后天，也要盖住 6F 实景棚的 7 天窗口
    assert.match(appSource, /Math\.max\(EXTENDED_BOOKING_WINDOW_DAYS - 1, isSimpleVideoRecipient\(\) \? 2 : 1\)/);
    // 后天的简易视频预约仍然可改，由共享模块的 isBookingEditable 单独放行
    // （行为覆盖见 test/booking-rules.test.js）。
    assert.match(sharedRulesSource, /isValidBookingDate\(day, booking\.studio, now\) \|\| day === getChinaDate\(2, now\)/);
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

test('待办未完成时在用户名旁显示可直接进入的醒目提醒', () => {
    const styles = fs.readFileSync('style.css', 'utf8');
    assert.match(indexSource, /id="simpleVideoShortcut"[^>]*class="simple-video-shortcut hidden"[^>]*onclick="switchView\('simple-video'\)"/);
    assert.match(appSource, /const showShortcut = isSimpleVideoRecipient\(\) && count > 0;/);
    assert.match(appSource, /shortcut\.classList\.toggle\('hidden', !showShortcut\)/);
    assert.match(appSource, /shortcut\.setAttribute\('aria-label', `简易视频待办，\$\{count\} 条待预约`\)/);
    assert.match(styles, /\.user-info \.simple-video-shortcut\s*\{[\s\S]*background: #E5484D;[\s\S]*font-weight: 700;/);
    assert.match(styles, /@media \(max-width: 768px\)[\s\S]*\.user-info \.simple-video-shortcut-label\s*\{[\s\S]*display: none;/);
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
    assert.match(appSource, /simple-video-task-label">原预约<\/span>/);
    assert.match(appSource, /simple-video-task-studio">\$\{escapeHtml\(booking\.studio\)\}<\/span>/);
    assert.match(appSource, /简易视频：\$\{booking\.simpleVideoCompleted/);
    assert.match(appSource, /simpleVideoStartTime: simpleVideoBooking\?\.startTime \|\| ''/);
    assert.match(serverSource, /AS "simpleVideoStartTime"/);
    assert.match(serverSource, /AS "simpleVideoEndTime"/);
    assert.doesNotMatch(renderSource, /摄影师：/);
    assert.doesNotMatch(renderSource, /影棚位置：/);
    assert.doesNotMatch(renderSource, /原摄影师预约：/);
    assert.doesNotMatch(renderSource, /已读 · 已预约对应日期无影棚/);
});

test('影棚名称和括号位置保持在同一行', () => {
    const styles = fs.readFileSync('style.css', 'utf8');
    assert.match(styles, /\.simple-video-task-studio\s*\{[\s\S]*display: inline-block;[\s\S]*white-space: nowrap;/);
    assert.match(styles, /\.simple-video-task-studio::before\s*\{[\s\S]*content: "· ";/);
});

test('简易视频待办只用文字区分已预约与待预约并保持卡片原色', () => {
    const styles = fs.readFileSync('style.css', 'utf8');
    assert.match(appSource, /simple-video-task-card \$\{booking\.simpleVideoCompleted \? 'is-booked' : 'is-pending'\}/);
    assert.match(appSource, /simple-video-task-status">\$\{booking\.simpleVideoCompleted \? '已预约' : '待预约'\}/);
    assert.match(styles, /\.simple-video-task-card\s*\{[\s\S]*border-left: 4px solid var\(--accent\);[\s\S]*background: #fff;/);
    assert.match(styles, /\.simple-video-task-card\.is-booked \.simple-video-task-status\s*\{[\s\S]*color: #15803d;/);
    assert.match(styles, /\.simple-video-task-card\.is-pending \.simple-video-task-status\s*\{[\s\S]*color: #c2410c;/);
    assert.doesNotMatch(styles, /\.simple-video-task-card\.is-(?:booked|pending)\s*\{[\s\S]*background:/);
});
