import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {datesForYear,demoCalendar,normalizeCalendar,weeksForCalendar,plantLayout,calendarSvg,THEMES} from './calendar.mjs';
for(const [year,count]of [[2026,365],[2024,366],[2012,366],[2100,365]]){
 const data=demoCalendar(year,`${year}-12-31`),model=plantLayout(data);
 assert.equal(datesForYear(year).length,count);assert.equal(model.leaves.length,count);assert.equal(new Set(model.leaves.map(l=>l.date)).size,count);assert.equal(model.leaves[0].date,`${year}-01-01`);assert.equal(model.leaves.at(-1).date,`${year}-12-31`);
 assert.equal(model.summaries.reduce((n,w)=>n+w.days.length,0),count);
 const future=plantLayout(demoCalendar(year,`${year}-06-01`));assert.deepEqual(future.leaves.map(({x,y,angle,date})=>({x,y,angle,date})),model.leaves.map(({x,y,angle,date})=>({x,y,angle,date})));
 for(const leaf of model.leaves){assert(leaf.x>30&&leaf.x<994&&leaf.y>80&&leaf.y<1200);assert(Number.isFinite(leaf.angle));}
}
const fixture=demoCalendar(2026,'2026-01-07','empty');fixture.days[0].count=700;fixture.days[0].level=4;const weeks=weeksForCalendar(fixture);assert.equal(weeks[0].mean,700/3);assert.equal(weeks[1].mean,0);assert.equal(weeks[2].mean,null);
const one=structuredClone(fixture),before=plantLayout(one);one.days[6].count=900000;one.days[6].level=4;const after=plantLayout(one);assert.equal(after.leaves.filter((l,i)=>l.count!==before.leaves[i].count||l.level!==before.leaves[i].level).length,1);
assert.throws(()=>normalizeCalendar([],{year:2026,asOf:'2026-01-01'}),/Missing/);
assert.throws(()=>normalizeCalendar([{date:'2026-01-01'},{date:'2026-01-01'}],{year:2026,asOf:'2026-01-01'}),/Duplicate/);
const root=path.resolve(import.meta.dirname,'..'),allIds=new Set();
for(const theme of Object.keys(THEMES)){
 const sprites=JSON.parse(fs.readFileSync(path.join(root,'artwork/calendar',theme+'-sprites.json')));assert.equal(Object.keys(sprites.tiles).length,40);
 for(const tile of Object.values(sprites.tiles))assert(tile.uri.startsWith('data:image/png;base64,'));
 const svg=calendarSvg(demoCalendar(),{theme,sprites});assert.equal((svg.match(/data-kind="day"/g)||[]).length,365);assert.equal((svg.match(/data-kind="week"/g)||[]).length,53);assert(!svg.includes('<script'));assert(!svg.includes('https://'));assert.equal(svg,calendarSvg(demoCalendar(),{theme,sprites}));
 for(const match of svg.matchAll(/\bid="([^"]+)"/g)){assert(!allIds.has(match[1]),'Theme IDs must not collide in the comparison page');allIds.add(match[1]);}
 for(const match of svg.matchAll(/<use href="#([^"]+)"/g))assert(match[1].startsWith('leaf-'+theme+'-'));
 const plain=calendarSvg(demoCalendar(),{theme,sprites,weekly:false});assert.equal((plain.match(/data-kind="day"/g)||[]).length,365);assert(!plain.includes('data-kind="week"'));
 const leap=calendarSvg(demoCalendar(2024),{theme,sprites});assert.equal((leap.match(/data-kind="day"/g)||[]).length,366);assert(leap.includes('2024-02-29'));
}
console.log('Calendar verified: unique dates, leap years, fixed geometry, one-day updates, weekly means, three embedded-image themes.');
