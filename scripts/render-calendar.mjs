import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {calendarSvg,demoCalendar,THEMES,PUBLISHED_THEMES} from './calendar.mjs';
import {fetchCalendar} from './fetch-calendar.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'images'),[login='ottuck',yearArg='2026',mode='github']=process.argv.slice(2),year=Number(yearArg);
if(!['github','demo'].includes(mode))throw new Error('Data source must be github or demo');
fs.mkdirSync(out,{recursive:true});
const data=mode==='github'?await fetchCalendar(login,year):demoCalendar(year),results=[];
fs.writeFileSync(path.join(out,'calendar-data.json'),JSON.stringify(data,null,2)+'\n');
for(const theme of PUBLISHED_THEMES){
 const palette=THEMES[theme];
 const sprites=JSON.parse(fs.readFileSync(path.join(root,'artwork/calendar',theme+'-sprites.json'))),svg=calendarSvg(data,{theme,sprites}),sha=createHash('sha256').update(svg).digest('hex'),filename=`calendar-${theme}.svg`;
 fs.writeFileSync(path.join(out,filename),svg);
 const animatedFilename=`calendar-${theme}-breeze.svg`,animated=calendarSvg(data,{theme,sprites,motion:'breeze'});
 fs.writeFileSync(path.join(out,animatedFilename),animated);
 results.push({theme,name:palette.name,filename,sha256:sha,bytes:Buffer.byteLength(svg),dailyLeaves:data.days.length,weeklyLeaves:(svg.match(/data-kind="week"/g)||[]).length,animatedFilename,animatedSha256:createHash('sha256').update(animated).digest('hex')});
}
const total=data.days.reduce((s,d)=>s+(d.count||0),0),active=data.days.filter(d=>d.count>0).length;
fs.writeFileSync(path.join(out,'calendar-state.json'),JSON.stringify({schema:3,source:data.source,login:data.login,year,asOf:data.asOf,totalContributions:total,activeDays:active,images:results},null,2)+'\n');
// The service README and embed guide are maintained separately from generated artwork.
console.log(JSON.stringify(results,null,2));
