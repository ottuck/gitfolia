import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {scenarioCalendar,demoCalendar,calendarSvg,plantLayout,THEMES} from './calendar.mjs';

export function verifyScenarios(){
 const root=path.resolve(import.meta.dirname,'..'),report=[];
 for(const year of [2026,2024])for(const kind of ['regression','year-end','dense']){
  const data=scenarioCalendar(year,kind),expectedDays=year===2024?366:365;
  assert.equal(data.asOf,`${year}-12-31`);assert.equal(data.days.length,expectedDays);assert(data.days.every(d=>!d.future));
  const day=suffix=>data.days.find(d=>d.date===`${year}-${suffix}`);
  if(kind==='regression'){
   for(const [suffix,count,level]of [['01-01',1,1],['01-02',0,0],['01-06',49,4],['07-31',0,0],['08-01',7,1],['12-24',30,3],['12-25',0,0],['12-31',90,4]])assert.deepEqual([day(suffix).count,day(suffix).level],[count,level]);
   assert.equal(data.days.filter(d=>d.count>0).length,21);
  }else if(kind==='year-end'){
   assert(data.days.filter(d=>d.date<`${year}-12-20`).every(d=>d.count===0&&d.level===0));
   assert.deepEqual([day('12-20').count,day('12-20').level],[40,4]);assert.deepEqual([day('12-25').count,day('12-25').level],[0,0]);assert.deepEqual([day('12-31').count,day('12-31').level],[95,4]);
   assert.equal(data.days.filter(d=>d.count>0).length,11);
  }else{assert(data.days.every(d=>d.count>=30&&d.count<=90&&d.level>=3));}
  const themes=[];
  for(const theme of Object.keys(THEMES)){
   const sprites=JSON.parse(fs.readFileSync(path.join(root,'artwork/calendar',theme+'-sprites.json')));
   const svg=calendarSvg(data,{theme,sprites,weekly:false});
   const nodes=[...svg.matchAll(/<g data-kind="day" ([^>]+)><title>([^<]*)<\/title><use href="#([^"]+)"[^>]*\/><\/g>/g)];
   assert.equal(nodes.length,expectedDays);assert(!svg.includes('data-kind="week"'));
   for(let i=0;i<data.days.length;i++){
    const d=data.days[i],[,attrs,title,symbol]=nodes[i];assert(attrs.includes(`data-date="${d.date}"`));assert(attrs.includes(`data-count="${d.count}"`));assert(attrs.includes(`data-level="${d.level}"`));assert(attrs.includes('opacity="1"'));
    assert.equal(symbol,`leaf-${theme}-${i%8}-${d.level}`);assert(svg.includes(`<symbol id="${symbol}"`));assert(title.includes(`${d.count} contributions · level ${d.level}`));
   }
   themes.push({theme,checked:expectedDays,colored:data.days.filter(d=>d.count>0).length,outline:data.days.filter(d=>d.count===0).length,mismatches:0});
  }
  // Advancing the selected/edit date must preserve older independent records.
  const edited=structuredClone(data),positions=plantLayout(edited).leaves.map(({x,y,angle})=>({x,y,angle}));
  for(const [suffix,count,level]of [['01-01',5,1],['07-01',40,4],['12-31',90,4]]){const d=edited.days.find(d=>d.date===`${year}-${suffix}`);d.count=count;d.level=level;}
  assert.equal(edited.days[0].count,5);assert.equal(edited.days.find(d=>d.date===`${year}-07-01`).count,40);
  assert.deepEqual(plantLayout(edited).leaves.map(({x,y,angle})=>({x,y,angle})),positions);
  report.push({year,scenario:kind,asOf:data.asOf,themes});
 }
 assert(demoCalendar().days.every(d=>!d.future),'Default demo must include December');
 assert(demoCalendar(2026,'2026-12-31','full').days.every(d=>d.level===4),'Fully painted demo must paint every daily leaf');
 return report;
}
if(process.argv[1]?.endsWith('verify-scenarios.mjs'))console.log(JSON.stringify(verifyScenarios(),null,2));
