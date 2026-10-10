import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
import {THEMES} from './calendar.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'images/previews')),baseline=process.argv[3]||'615aa7e';
fs.mkdirSync(out,{recursive:true});let content='';
for(const [index,[theme,palette]] of Object.entries(Object.entries(THEMES))){
 const before=spawnSync('git',['show',`${baseline}:artwork/calendar/${theme}-sprites.json`],{cwd:root,encoding:'utf8',windowsHide:true});if(before.status!==0)throw new Error('Cannot read baseline '+baseline);
 const sets=[['Before',JSON.parse(before.stdout)],['After',JSON.parse(fs.readFileSync(path.join(root,'artwork/calendar',theme+'-sprites.json')))]],y=116+Number(index)*236;
 content+=`<rect x="24" y="${y}" width="1192" height="222" rx="8" fill="${palette.paper}"/><text x="48" y="${y+29}" fill="${palette.ink}" font-size="18">${palette.latin}</text>`;
 for(let row=0;row<2;row++){
  const [label,sprites]=sets[row];content+=`<text x="48" y="${y+77+row*83}" fill="${palette.ink}" font-size="15">${label}</text>`;
  for(let level=0;level<=4;level++)content+=`<image href="${sprites.tiles[`0-${level}`].uri}" x="${215+level*191}" y="${y+44+row*83}" width="139" height="56" preserveAspectRatio="xMidYMid meet"/><text x="${284+level*191}" y="${y+115+row*83}" text-anchor="middle" fill="${palette.ink}" font-size="12">${level===0?'No activity':'Level '+level}</text>`;
 }
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="854" font-family="Georgia,serif"><rect width="1240" height="854" fill="#f5f2e9"/><text x="36" y="50" fill="#354636" font-size="27">A clearer contribution color scale</text><text x="36" y="80" fill="#78816d" font-size="15">Same leaf illustration and GitHub level. Stronger paint density and brightness separation.</text>${content}</svg>`;
fs.writeFileSync(path.join(out,'color-comparison.svg'),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(out,'color-comparison.png'));
console.log('Saved before/after comparison with unchanged leaf artwork.');
