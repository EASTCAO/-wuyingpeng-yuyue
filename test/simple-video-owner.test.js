const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const appSource = fs.readFileSync('app.js', 'utf8');
const serverSource = fs.readFileSync('api/server.js', 'utf8');

test('简易视频负责人默认并迁移为涂萱', () => {
    assert.match(appSource, /const DEFAULT_SIMPLE_VIDEO_OWNER = '涂萱';/);
    assert.match(appSource, /!storedOwner \|\| storedOwner === '李冬梅' \? DEFAULT_SIMPLE_VIDEO_OWNER : storedOwner/);
    assert.match(serverSource, /VALUES \('simple_video_owner', '涂萱'\)/);
    assert.match(serverSource, /value IN \('', '李冬梅'\)/);
});

test('负责人即使暂无待办也保留简易视频入口', () => {
    assert.match(appSource, /el\.classList\.toggle\('hidden', currentUser !== simpleVideoOwner\);/);
    assert.doesNotMatch(appSource, /currentUser !== simpleVideoOwner \|\| simpleVideoTasks\.length === 0/);
});
