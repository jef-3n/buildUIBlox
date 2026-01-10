import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const now = new Date();
const build = now.toISOString().replace(/[-:.TZ]/g,'');

pkg.version = `0.1.${build}`;
fs.writeFileSync('package.json', JSON.stringify(pkg,null,2));
console.log('Version set to', pkg.version);
