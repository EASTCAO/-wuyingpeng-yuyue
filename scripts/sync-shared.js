// 把 shared/ 下的共享模块同步到各个部署单元。
//
// 后端在 Zeabur 上以 ./api 为构建根目录，无法 require 仓库根目录的文件，
// 所以必须在 api/ 下保留一份副本。副本由本脚本生成，不要手工编辑。
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

const COPIES = [
    { from: 'shared/booking-rules.js', to: 'api/booking-rules.js' }
];

let changed = 0;
for (const { from, to } of COPIES) {
    const source = fs.readFileSync(path.join(projectRoot, from), 'utf8');
    const targetPath = path.join(projectRoot, to);
    const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;
    if (existing === source) {
        console.log(`= ${to} 已是最新`);
        continue;
    }
    fs.writeFileSync(targetPath, source);
    console.log(`✓ ${from} -> ${to}`);
    changed += 1;
}

console.log(changed === 0 ? '共享模块无需同步' : `已同步 ${changed} 个文件`);
