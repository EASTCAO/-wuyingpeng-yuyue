const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const styles = fs.readFileSync('style.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const serve = JSON.parse(fs.readFileSync('serve.json', 'utf8'));

test('中文字体自带子集，不依赖墙外 CDN', () => {
    const face = styles.match(/@font-face\s*\{([\s\S]*?)\n\}/);
    assert.ok(face, '没有找到 @font-face');
    assert.match(face[1], /font-family:\s*"Noto Sans SC"/);
    assert.match(face[1], /url\("assets\/fonts\/noto-sans-sc-subset\.woff2"\)/);
    assert.match(face[1], /format\("woff2"\)/);
    // 可变字体：一个文件覆盖全字重，正文到标题不用再加载第二份。
    assert.match(face[1], /font-weight:\s*100 900/);
    // 字体没下来时先显示系统字，避免首屏空白。
    assert.match(face[1], /font-display:\s*swap/);
    assert.doesNotMatch(styles, /https?:\/\/[^"')]*\.woff2/);

    const file = fs.statSync('assets/fonts/noto-sans-sc-subset.woff2');
    assert.ok(file.size > 0, '字体文件为空');
});

test('正文字体栈把自带中文字体排在系统字之前', () => {
    const body = styles.match(/\nbody\s*\{([\s\S]*?)\n\}/);
    assert.ok(body, '没有找到 body 规则');
    assert.match(body[1], /font-family:\s*"Noto Sans SC",/);
    // 字体加载失败时仍有系统栈兜底，不能只剩一个自造字体名。
    assert.match(body[1], /-apple-system|"Segoe UI"|sans-serif/);
});

test('字体进了首屏预加载和离线缓存，并且能长缓存', () => {
    assert.match(html, /<link rel="preload" href="assets\/fonts\/noto-sans-sc-subset\.woff2"[^>]*as="font"[^>]*crossorigin>/);
    assert.match(sw, /'\.\/assets\/fonts\/noto-sans-sc-subset\.woff2'/);

    // 字体是带版本号的静态资源，应走 immutable；漏掉 woff2 会每次回源。
    const immutable = serve.headers.find(entry => /js\|css\|webp/.test(entry.source));
    assert.ok(immutable, '没有找到静态资源缓存规则');
    assert.match(immutable.source, /woff2/);
    assert.match(immutable.headers[0].value, /immutable/);
});
