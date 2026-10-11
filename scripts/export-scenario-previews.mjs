import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {scenarioCalendar,calendarSvg,THEMES} from './calendar.mjs';
import {verifyScenarios} from './verify-scenarios.mjs';
import {verifyColorScale} from './verify-color-scale.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'images/scenario-previews'));
fs.mkdirSync(out,{recursive:true});
for(const kind of ['regression','year-end','dense']){
 const data=scenarioCalendar(2026,kind);fs.writeFileSync(path.join(out,kind+'-data.json'),JSON.stringify(data,null,2)+'\n');
 for(const theme of Object.keys(THEMES)){
  const sprites=JSON.parse(fs.readFileSync(path.join(root,'artwork/calendar',theme+'-sprites.json'))),svg=calendarSvg(data,{theme,sprites,weekly:false});
  fs.writeFileSync(path.join(out,`${theme}-${kind}.svg`),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(out,`${theme}-${kind}.png`));
 }
}
fs.writeFileSync(path.join(out,'scenario-verification.json'),JSON.stringify(verifyScenarios(),null,2)+'\n');
fs.writeFileSync(path.join(out,'color-verification.json'),JSON.stringify(await verifyColorScale(),null,2)+'\n');
console.log('Exported all three full-year scenarios, original test data and validation results.');
