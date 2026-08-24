// 会话令牌的行为测试。改密码让旧 token 失效是安全性改动里最容易写错的一处，
// 写错的后果是所有人被锁在门外，所以必须在没有数据库的情况下也能验证。
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const { createTokenCodec, getTokenVersion } = require('../api/auth-token');

const SECRET = 'a'.repeat(48);
const OTHER_SECRET = 'b'.repeat(48);
const NOW = Date.UTC(2026, 7, 24, 4, 0);

function makeUser(overrides = {}) {
    return {
        username: '曹东',
        role: 'photographer',
        passwordHash: 'salt123:deadbeef',
        ...overrides
    };
}

test('缺少密钥时拒绝创建编解码器', () => {
    assert.throws(() => createTokenCodec(''), /AUTH_SECRET/);
    assert.throws(() => createTokenCodec(undefined), /AUTH_SECRET/);
});

test('签发的 token 能被自己读回，并带上用户名和角色', () => {
    const codec = createTokenCodec(SECRET);
    const user = makeUser({ role: 'admin' });
    const parsed = codec.read(codec.sign(user, NOW), NOW);

    assert.equal(parsed.username, '曹东');
    assert.equal(parsed.role, 'admin');
    assert.equal(parsed.ver, getTokenVersion(user.passwordHash));
    assert.equal(parsed.exp, NOW + 7 * 24 * 60 * 60 * 1000);
});

test('token 过期后不再有效', () => {
    const codec = createTokenCodec(SECRET);
    const token = codec.sign(makeUser(), NOW);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    assert.ok(codec.read(token, NOW + sevenDays - 1000), '还没到期');
    assert.equal(codec.read(token, NOW + sevenDays), null, '正好到期');
    assert.equal(codec.read(token, NOW + sevenDays + 1000), null, '已过期');
});

test('换了密钥就读不出来，防止伪造', () => {
    const token = createTokenCodec(SECRET).sign(makeUser(), NOW);
    assert.equal(createTokenCodec(OTHER_SECRET).read(token, NOW), null);
});

test('篡改 payload 会让签名校验失败', () => {
    const codec = createTokenCodec(SECRET);
    const token = codec.sign(makeUser({ role: 'photographer' }), NOW);
    const [payload, signature] = token.split('.');

    // 把角色改成 admin，签名不变。
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    decoded.role = 'admin';
    const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');

    assert.equal(codec.read(`${forgedPayload}.${signature}`, NOW), null);
});

test('畸形 token 一律返回 null 而不是抛异常', () => {
    const codec = createTokenCodec(SECRET);
    const inputs = ['', null, undefined, 'abc', 'abc.', '.abc', 'a.b.c', 'x'.repeat(500),
        `${Buffer.from('not json').toString('base64url')}.deadbeef`];
    for (const input of inputs) {
        assert.equal(codec.read(input, NOW), null, `输入: ${String(input).slice(0, 20)}`);
    }
});

test('签名长度不同时不会因为 timingSafeEqual 抛异常', () => {
    const codec = createTokenCodec(SECRET);
    const [payload] = codec.sign(makeUser(), NOW).split('.');
    assert.equal(codec.read(`${payload}.short`, NOW), null);
});

test('改密码后旧 token 立刻失效，新 token 正常', () => {
    const codec = createTokenCodec(SECRET);
    const before = makeUser({ passwordHash: 'salt1:oldhash' });
    const oldToken = codec.read(codec.sign(before, NOW), NOW);

    // 旧 token 对旧密码有效。
    assert.ok(codec.matchesUser(oldToken, before));

    // 用户改了密码，数据库里的哈希变了。
    const after = makeUser({ passwordHash: 'salt2:newhash' });
    assert.ok(!codec.matchesUser(oldToken, after), '旧 token 必须失效');

    // 重新签发的 token 对新密码有效。
    const newToken = codec.read(codec.sign(after, NOW), NOW);
    assert.ok(codec.matchesUser(newToken, after));
    assert.ok(!codec.matchesUser(newToken, before), '新 token 不该对旧密码有效');
});

test('用户不存在或 token 为空时校验失败', () => {
    const codec = createTokenCodec(SECRET);
    const tokenUser = codec.read(codec.sign(makeUser(), NOW), NOW);
    assert.ok(!codec.matchesUser(tokenUser, null));
    assert.ok(!codec.matchesUser(null, makeUser()));
    assert.ok(!codec.matchesUser(null, null));
});

test('密码指纹是确定的、定长的，且不泄漏原哈希', () => {
    const hash = 'salt:' + crypto.randomBytes(64).toString('hex');
    const version = getTokenVersion(hash);

    assert.equal(version, getTokenVersion(hash), '同样输入得到同样指纹');
    assert.equal(version.length, 16);
    assert.notEqual(version, getTokenVersion(hash + 'x'));
    assert.ok(!hash.includes(version), '指纹不能是原哈希的片段');
    assert.equal(getTokenVersion(null), getTokenVersion(''));
});
