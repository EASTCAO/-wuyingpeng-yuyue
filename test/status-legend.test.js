const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

test('6F和7F共用图例，部分预约和已约满颜色与卡面一致', () => {
    const css = fs.readFileSync('studio-layout.css', 'utf8');
    for (const state of ['partial', 'full']) {
        const legend = css.match(new RegExp(`\\.preview-legend-swatch\\.${state}\\s*\\{([^}]+)\\}`))[1];
        for (const floor of ['.preview-floor-map-sixth-floor .sixth-floor-layout-card', '.preview-floor-map:not(.preview-floor-map-sixth-floor)']) {
            const selector = `${floor}${floor.includes('sixth-floor-layout-card') ? '' : ' '}.preview-scene-card.${state} {`;
            const block = css.slice(css.indexOf(selector)).split('}')[0];
            const wash = block.match(/--state-wash:\s*([^;]+);/)[1];
            assert.ok(legend.replace(/\s+/g, '').includes(wash.replace(/\s+/g, '')), state);
        }
    }
    const source = fs.readFileSync('studio-layout.js', 'utf8');
    assert.ok((source.match(/renderPreviewStatusLegend\(\)/g) || []).length >= 3);
});
