import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {PUBLISHED_THEMES,calendarSvg,demoCalendar} from './calendar.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'images/previews'));
fs.mkdirSync(out,{recursive:true});const real=JSON.parse(fs.readFileSync(path.join(root,'images/calendar-data.json')));
for(const theme of PUBLISHED_THEMES){
 const sprites=JSON.parse(fs.readFileSync(path.join(root,'artwork/calendar',theme+'-sprites.json')));
 for(const [state,data]of [['actual',real],['example',demoCalendar(real.year,`${real.year}-12-31`)]]){
  const svg=calendarSvg(data,{theme,sprites});fs.writeFileSync(path.join(out,theme+'-'+state+'.svg'),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(out,theme+'-'+state+'.png'));
 }
}
console.log('Exported watercolor in actual and example states.');
