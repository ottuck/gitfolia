import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// A fresh, independent API response is compared with the stored records AND
// each exported SVG's count, level, opacity and actual sprite reference.
// This deliberately does not use the renderer's normalization/layout helpers.
const root=path.resolve(import.meta.dirname,'..');
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
// Copyable examples are code, not displayed artwork. The service README shows
// the hosted image; the independent checks below verify the generated archive.
const displayedReadme=readme.replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm,'');
assert.equal((displayedReadme.match(/<img\b/g)||[]).length,1,'README must display exactly one plant');
assert(/<img src="https:\/\/botanical-garden\.ottuck\.workers\.dev\/ottuck"/.test(displayedReadme),'README must display the hosted GitLeaf image');
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'images/calendar-data.json')));
const body={query:'query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){contributionCalendar{weeks{contributionDays{date contributionCount contributionLevel}}}}}}',variables:{login:snapshot.login,from:`${snapshot.year}-01-01T00:00:00Z`,to:`${snapshot.asOf}T23:59:59Z`}};
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;let payload;
if(token){
 const response=await fetch('https://api.github.com/graphql',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','User-Agent':'botanical-calendar-verification'},body:JSON.stringify(body)});
 assert(response.ok,'Verification API request failed: '+response.status);payload=await response.json();
}else{
 const result=spawnSync('gh',['api','graphql','--input','-'],{input:JSON.stringify(body),encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,'Verification API request failed');payload=JSON.parse(result.stdout);
}
assert(!payload.errors,'Verification API returned errors');
const raw=payload.data.user.contributionsCollection.contributionCalendar.weeks.flatMap(w=>w.contributionDays);
const api=new Map(raw.map(d=>[d.date,d]));assert.equal(api.size,raw.length,'No duplicate API dates');
const levels=['NONE','FIRST_QUARTILE','SECOND_QUARTILE','THIRD_QUARTILE','FOURTH_QUARTILE'];
const dates=[];for(let date=new Date(`${snapshot.year}-01-01T00:00:00Z`);date.getUTCFullYear()===snapshot.year;date.setUTCDate(date.getUTCDate()+1))dates.push(date.toISOString().slice(0,10));
assert.equal(snapshot.days.length,dates.length);
for(let i=0;i<dates.length;i++){
 const date=dates[i],stored=snapshot.days[i];assert.equal(stored.date,date);
 if(date>snapshot.asOf){assert.equal(stored.count,null);assert.equal(stored.level,null);assert.equal(stored.future,true);continue;}
 const day=api.get(date);assert(day,'Missing API date: '+date);
 assert.equal(stored.count,day.contributionCount,date+' count differs from fresh GitHub response');
 assert.equal(stored.level,levels.indexOf(day.contributionLevel),date+' level differs from fresh GitHub response');assert.equal(stored.future,false);
}
const weeks=[];for(const date of dates){if(!weeks.length||new Date(date+'T00:00:00Z').getUTCDay()===0)weeks.push([]);weeks.at(-1).push(date);}
const means=weeks.map(week=>{const past=week.filter(date=>date<=snapshot.asOf);return past.length?past.reduce((n,date)=>n+api.get(date).contributionCount,0)/past.length:null;});
const maximum=Math.max(0,...means.filter(x=>x!==null));
const themes=['watercolor'],images=[];
for(const theme of themes)for(const motion of ['none','breeze']){
 const file=`calendar-${theme}${motion==='breeze'?'-breeze':''}.svg`,svg=fs.readFileSync(path.join(root,'images',file),'utf8');
 const sprites=JSON.parse(fs.readFileSync(path.join(root,'artwork/calendar',theme+'-sprites.json')));
 const symbols=new Map([...svg.matchAll(/<symbol id="([^"]+)"[^>]*><image href="([^"]+)"/g)].map(m=>[m[1],m[2]]));
 const daily=[...svg.matchAll(/<g data-kind="day" ([^>]+)><title>([^<]*)<\/title><use href="#([^"]+)"[^>]*\/><\/g>/g)];
 assert.equal(daily.length,dates.length);assert.equal(new Set(daily.map(m=>m[1].match(/data-date="([^"]+)"/)[1])).size,dates.length);
 for(let i=0;i<dates.length;i++){
  const date=dates[i],future=date>snapshot.asOf,day=api.get(date),level=future?0:levels.indexOf(day.contributionLevel),[,attrs,title,sprite]=daily[i];
  assert(attrs.includes(`data-date="${date}"`));assert(attrs.includes(`data-count="${future?'future':day.contributionCount}"`));assert(attrs.includes(`data-level="${future?'future':level}"`));assert(attrs.includes(`opacity="${future?.3:1}"`));
  assert.equal(sprite,`leaf-${theme}-${i%8}-${level}`,`${theme} ${date}: wrong painted sprite`);
  assert.equal(symbols.get(sprite),sprites.tiles[`${i%8}-${level}`].uri,`${theme} ${date}: wrong PNG paint asset`);
  if(!future)assert(title.includes(`${day.contributionCount} contributions · level ${level}`));
 }
 const summaries=[...svg.matchAll(/<g data-kind="week" ([^>]+)><title>([^<]*)<\/title><use href="#([^"]+)"[^>]*\/><\/g>/g)];assert.equal(summaries.length,weeks.length);
 for(let i=0;i<weeks.length;i++){
  const level=means[i]===null||means[i]===0?0:Math.min(4,Math.max(1,Math.ceil(means[i]/maximum*4)));
  assert.equal(summaries[i][3],`leaf-${theme}-${i%8}-${level}`);
  assert.equal(symbols.get(summaries[i][3]),sprites.tiles[`${i%8}-${level}`].uri);
  if(means[i]!==null)assert(summaries[i][2].includes(means[i].toFixed(1)+' contributions/day'));
 }
 images.push({theme,motion,file,sha256:createHash('sha256').update(svg).digest('hex'),dailyLeavesChecked:daily.length,weeklyLeavesChecked:summaries.length,mismatches:0});
}
const report={checkedAt:new Date().toISOString(),login:snapshot.login,year:snapshot.year,asOf:snapshot.asOf,source:'Fresh GitHub GraphQL contributionCalendar response using the current authenticated scope',readmeDisplayedImages:1,readmeTheme:'watercolor',pastDatesChecked:dates.filter(d=>d<=snapshot.asOf).length,futureDatesChecked:dates.filter(d=>d>snapshot.asOf).length,totalContributions:snapshot.days.reduce((n,d)=>n+(d.count||0),0),levels:levels.map((name,level)=>{const days=snapshot.days.filter(d=>d.level===level);return {level,name,days:days.length,sample:days.sort((a,b)=>b.count-a.count)[0]};}),images,mismatches:0};
const out=path.resolve(process.argv[2]||path.join(root,'images/calendar-validation.json'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
