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
