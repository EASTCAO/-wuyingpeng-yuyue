const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const styles = fs.readFileSync('studio-layout.css', 'utf8');

function rule(selector) {
    return styles.match(new RegExp(`(?:^|\\n)${selector}\\s*\\{([\\s\\S]*?)\\n\\}`));
}

const sixthGlass = String.raw`\.preview-floor-map-sixth-floor \.sixth-floor-layout-card\.preview-scene-card`;
const seventhAvailable = String.raw`\.preview-floor-map:not\(\.preview-floor-map-sixth-floor\) \.preview-scene-card\.available`;
const seventhFull = String.raw`\.preview-floor-map:not\(\.preview-floor-map-sixth-floor\) \.preview-scene-card\.full`;

function background(ruleBody) {
    const match = ruleBody.match(/background:([\s\S]*?);/);
    assert.ok(match, '没有找到卡面背景');
    return match[1]
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

test('7F 可预约和已约满卡面复用 6F 的玻璃配色', () => {
    const reference = rule(sixthGlass);
    const sharedSeventhFloor = styles.match(
        new RegExp(`${seventhAvailable},\\s*\\n${seventhFull}\\s*\\{([\\s\\S]*?)\\n\\}`)
    );

    assert.ok(reference, '没有找到 6F 卡面规则');
    assert.ok(sharedSeventhFloor, '没有找到 7F 状态卡共用的卡面规则');
    assert.equal(
        background(sharedSeventhFloor[1]),
        background(reference[1]),
        '7F 可预约和已约满必须使用与 6F 相同的卡面配色'
    );
    assert.match(sharedSeventhFloor[1], /backdrop-filter:\s*blur\(26px\) saturate\(170%\) brightness\(1\.05\);/);
});

test('7F 可预约沿用 6F 的冷灰边框', () => {
    const available = rule(seventhAvailable);
    assert.ok(available, '没有找到 7F 可预约卡规则');
    assert.match(available[1], /--card-border:\s*#7C8A9E;/);
    assert.match(available[1], /border-color:\s*var\(--card-border\);/);
});

test('7F 已约满沿用 6F 的近黑卡面和状态色', () => {
    const full = rule(seventhFull);
    assert.ok(full, '没有找到 7F 已约满卡规则');
    assert.match(full[1], /--state-wash:\s*rgba\(34, 34, 36, 1\) 0%, rgba\(25, 26, 29, 1\) 100%;/);
    assert.match(full[1], /--card-edge:\s*#101113;/);
    assert.match(full[1], /--card-border:\s*#17181A;/);

    const title = rule(
        String.raw`\.preview-floor-map:not\(\.preview-floor-map-sixth-floor\) \.preview-scene-card\.full\.has-scene-cover h4,\s*\n\.preview-floor-map:not\(\.preview-floor-map-sixth-floor\) \.preview-scene-card\.full\.has-scene-cover\.has-progress h4`
    );
    assert.ok(title, '没有找到 7F 已约满景名规则');
    assert.match(title[1], /color:\s*#F7F7F8;/);

    const label = rule(
        String.raw`\.preview-floor-map:not\(\.preview-floor-map-sixth-floor\) \.preview-scene-card\.full \.preview-scene-full-label`
    );
    assert.ok(label, '没有找到 7F 已约满状态胶囊规则');
    assert.match(label[1], /background:\s*#4A4D52;/);
    assert.match(label[1], /color:\s*#F0F1F3;/);
});
