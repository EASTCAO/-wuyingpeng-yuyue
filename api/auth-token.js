// 会话令牌的签发与校验。单独成文件是为了能在没有数据库的环境下直接做单元测试
// （test/auth-token.test.js），登录相关的改动不应该只能靠线上验证。
const crypto = require('crypto');

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// 把密码哈希压成一个短指纹放进 token。改密码后哈希变了，指纹跟着变，
// 所有旧 token 立刻失效——否则账号被盗时改密码根本挡不住攻击者。
function getTokenVersion(passwordHash) {
    return crypto.createHash('sha256').update(String(passwordHash || '')).digest('base64url').slice(0, 16);
}

function createTokenCodec(secret, { ttlMs = TOKEN_TTL_MS } = {}) {
    if (!secret) throw new Error('AUTH_SECRET is not configured');

    function sign(user, now = Date.now()) {
        const payload = Buffer.from(JSON.stringify({
            username: user.username,
            role: user.role,
            ver: getTokenVersion(user.passwordHash),
            exp: now + ttlMs
        })).toString('base64url');
        const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
        return `${payload}.${signature}`;
    }

    function read(token, now = Date.now()) {
        if (!token) return null;
        const [payload, signature] = String(token).split('.');
        if (!payload || !signature) return null;

        const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
        // 长度不同时 timingSafeEqual 会抛异常，所以先比长度。
        if (signature.length !== expected.length) return null;
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

        try {
            const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
            return parsed.exp > now ? parsed : null;
        } catch {
            return null;
        }
    }

    // token 有效 + 用户还在 + 密码没换过，三者同时满足才算登录有效。
    function matchesUser(tokenUser, user) {
        return Boolean(tokenUser && user && tokenUser.ver === getTokenVersion(user.passwordHash));
    }

    return { sign, read, matchesUser };
}

module.exports = { createTokenCodec, getTokenVersion, TOKEN_TTL_MS };
