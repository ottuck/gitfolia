export const LEVELS = ['NONE','FIRST_QUARTILE','SECOND_QUARTILE','THIRD_QUARTILE','FOURTH_QUARTILE'];
export const PUBLISHED_THEMES = ['watercolor'];
export const THEMES = {
 watercolor:{name:'수채화 양치식물',latin:'Watercolor fern',paper:'#f6f0e2',ink:'#685b43',stem:'#82714c',light:'#ae9a6a',line:'#b3a58b',dark:false},
 herbarium:{name:'동판화 허바리움',latin:'Engraved herbarium',paper:'#f4eddc',ink:'#554934',stem:'#6a583a',light:'#9c8252',line:'#97866c',dark:false},
 midnight:{name:'미드나이트 식물 도감',latin:'Midnight botanical',paper:'#142437',ink:'#cad6cf',stem:'#a59665',light:'#d2c394',line:'#71868c',dark:true}
};
const pad=n=>String(n).padStart(2,'0');
export function datesForYear(year){
 if(!Number.isInteger(year)||year<2000||year>2100)throw new Error('Year must be 2000–2100');
 const dates=[];for(let d=new Date(Date.UTC(year,0,1));d.getUTCFullYear()===year;d.setUTCDate(d.getUTCDate()+1))dates.push(`${year}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`);return dates;
}
/**
 * @param {Array<{date:string,contributionCount:number,contributionLevel:string}>} raw
 * @param {{year:number,asOf:string,login?:string,source?:string}} options
 */
export function normalizeCalendar(raw,{year,asOf,login='',source='github'}={}){
 const dates=datesForYear(year);if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||Number.isNaN(Date.parse(asOf+'T00:00:00Z')))throw new Error('Invalid asOf date');
 const byDate=new Map();for(const day of raw){if(byDate.has(day.date))throw new Error('Duplicate date: '+day.date);byDate.set(day.date,day);}
 const days=dates.map(date=>{
  if(date>asOf)return {date,count:null,level:null,future:true};
  const d=byDate.get(date);if(!d)throw new Error('Missing past date: '+date);
  const level=LEVELS.indexOf(d.contributionLevel);if(level<0||!Number.isInteger(d.contributionCount)||d.contributionCount<0||(d.contributionCount===0)!==(level===0))throw new Error('Invalid contribution data: '+date);
  return {date,count:d.contributionCount,level,future:false};
 });
 return {schema:3,year,asOf,login,source,days};
}
export function demoCalendar(year=2026,asOf=`${year}-12-31`,kind='mixed'){
 const raw=datesForYear(year).map((date,i)=>{const count=kind==='empty'?0:kind==='full'?60:((i*23+Math.floor(i/7)*11)%19<8?0:1+(i*13)%45);return {date,contributionCount:count,contributionLevel:LEVELS[count===0?0:Math.min(4,Math.ceil(count/12))]};});
 return normalizeCalendar(raw,{year,asOf,source:'demo'});
}
export function scenarioCalendar(year=2026,kind='regression'){
 if(!['regression','year-end','dense'].includes(kind))throw new Error('Unknown test scenario');
 const anchors={'01-01':1,'01-03':12,'01-04':13,'01-05':25,'01-06':49,'02-01':3,'03-15':20,'04-01':36,'06-30':48,'08-01':7,'09-30':27,'10-01':80,'11-30':36,'12-01':40,'12-24':30,'12-26':40,'12-27':50,'12-28':60,'12-29':70,'12-30':80,'12-31':90};
 const raw=datesForYear(year).map((date,i)=>{
  const suffix=date.slice(5),count=kind==='dense'?30+i%61:kind==='year-end'?(suffix>='12-20'&&suffix!=='12-25'?40+(Number(suffix.slice(3))-20)*5:0):(anchors[suffix]||0);
  return {date,contributionCount:count,contributionLevel:LEVELS[count===0?0:Math.min(4,Math.ceil(count/12))]};
 });
 return {...normalizeCalendar(raw,{year,asOf:`${year}-12-31`,source:'demo'}),scenario:kind};
}
export function weeksForCalendar(data){
 const weeks=[];for(const day of data.days){const weekday=new Date(day.date+'T00:00:00Z').getUTCDay();if(!weeks.length||weekday===0)weeks.push({index:weeks.length,days:[]});weeks.at(-1).days.push(day);}
 const means=weeks.map(w=>{const past=w.days.filter(d=>!d.future);return past.length?past.reduce((s,d)=>s+d.count,0)/past.length:null;});
 const max=Math.max(0,...means.filter(v=>v!==null));return weeks.map((w,i)=>({...w,mean:means[i],level:means[i]===null?null:means[i]===0?0:Math.min(4,Math.max(1,Math.ceil(means[i]/max*4))),future:means[i]===null}));
}
const jitter=i=>{let n=Math.imul(i+73,0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;};
const point=(p,t)=>({x:(1-t)**2*p[0].x+2*(1-t)*t*p[1].x+t*t*p[2].x,y:(1-t)**2*p[0].y+2*(1-t)*t*p[1].y+t*t*p[2].y});
export function plantLayout(data){
 const weeks=weeksForCalendar(data),leaves=[],summaries=[],branches=[],stems=[];
 const curves=[[{x:481,y:1160},{x:320,y:900},{x:205,y:400}],[{x:503,y:1160},{x:420,y:710},{x:370,y:135}],[{x:522,y:1160},{x:650,y:710},{x:665,y:145}],[{x:544,y:1160},{x:800,y:910},{x:850,y:410}]];
 for(let q=0;q<4;q++){
  const selected=weeks.slice(Math.floor(q*weeks.length/4),Math.floor((q+1)*weeks.length/4)),p=curves[q];stems.push(`M${p[0].x} ${p[0].y} Q${p[1].x} ${p[1].y} ${p[2].x} ${p[2].y}`);
  selected.forEach((week,row)=>{
   const t=.15+.78*row/Math.max(1,selected.length-1),base=point(p,t),near=point(p,t+.001),tangent=Math.atan2(near.y-base.y,near.x-base.x),side=row%2?1:-1;
   const angle=tangent+side*(1.05+.08*jitter(week.index)),dx=Math.cos(angle),dy=Math.sin(angle);
   const room=dx>0?(914-base.x)/dx:(90-base.x)/dx,length=Math.max(50,Math.min(138+30*Math.sin(t*Math.PI),room)),end={x:base.x+dx*length,y:base.y+dy*length};
   branches.push(`M${base.x} ${base.y} Q${base.x+dx*length*.56} ${base.y+dy*length*.56-5} ${end.x} ${end.y}`);
   week.days.forEach((day,j)=>{
    const pair=Math.floor(j/2);
    const u=.20+.19*pair+(j%2)*.018,sign=j%2?1:-1,a=angle+sign*1.02;
    leaves.push({...day,x:base.x+dx*length*u,y:base.y+dy*length*u-3,angle:a*180/Math.PI,length:43+11*jitter(leaves.length),variant:leaves.length%8,week:week.index});
   });
   summaries.push({...week,x:end.x,y:end.y,angle:angle*180/Math.PI,length:59,variant:week.index%8});
  });
 }
 return {width:1024,height:1536,leaves,summaries,branches,stems};
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
/**
 * @param {ReturnType<typeof normalizeCalendar>} data
 * @param {{theme?:string,sprites:{theme:string,tiles:Record<string,{width:number,height:number,uri:string}>},weekly?:boolean,labels?:boolean}} options
 */
export function calendarSvg(data,{theme='watercolor',sprites,weekly=true,labels=true}={}){
 const palette=THEMES[theme];if(!palette||!sprites||sprites.theme!==theme)throw new Error('Missing or mismatched theme sprites');
 const model=plantLayout(data),used=new Map(),active=data.days.filter(d=>!d.future&&d.count>0).length,total=data.days.reduce((n,d)=>n+(d.count||0),0);
 const leafTag=(leaf,kind)=>{
  const level=leaf.level??0,key=`${leaf.variant}-${level}`,sprite=sprites.tiles[key];if(!sprite)throw new Error('Missing sprite '+key);used.set(key,sprite);
  const title=kind==='day'?`${leaf.date}: ${leaf.future?'아직 오지 않은 날':leaf.count+' contributions · level '+leaf.level}`:`${leaf.days[0].date}–${leaf.days.at(-1).date}: ${leaf.mean===null?'아직 오지 않은 주':leaf.mean.toFixed(1)+' contributions/day'} (주 평균)`;
  const ratio=sprite.height/sprite.width;
  return `<g data-kind="${kind}" ${kind==='day'?`data-date="${leaf.date}" data-count="${leaf.count??'future'}" data-level="${leaf.level??'future'}"`:`data-week="${leaf.index}"`} transform="translate(${leaf.x.toFixed(2)} ${leaf.y.toFixed(2)}) rotate(${leaf.angle.toFixed(2)})" opacity="${leaf.future?.3:1}"><title>${esc(title)}</title><use href="#leaf-${theme}-${key}" x="-1" y="${(-leaf.length*ratio/2).toFixed(2)}" width="${leaf.length.toFixed(2)}" height="${(leaf.length*ratio).toFixed(2)}"/></g>`;
 };
 const foliage=model.leaves.map(l=>leafTag(l,'day')).join('')+(weekly?model.summaries.map(l=>leafTag(l,'week')).join(''):'');
 const defs=[...used].map(([key,s])=>`<symbol id="leaf-${theme}-${key}" viewBox="0 0 ${s.width} ${s.height}"><image href="${s.uri}" width="${s.width}" height="${s.height}"/></symbol>`).join('');
 const stroke=(paths,width)=>paths.map(d=>`<path d="${d}" fill="none" stroke="${palette.stem}" stroke-width="${width+2}" opacity=".12"/><path d="${d}" fill="none" stroke="${palette.stem}" stroke-width="${width}"/><path d="${d}" fill="none" stroke="${palette.light}" stroke-width="${width*.32}" opacity=".6"/>`).join('');
 let roots='';for(let i=0;i<34;i++){
  const side=i%2?1:-1,x=487+jitter(i)*48,endx=512+side*(25+jitter(i+3)*135),endy=1270+jitter(i+35)*82,c1x=x+side*(10+jitter(i+9)*32),c2x=endx-side*20;
  roots+=`<path d="M${x.toFixed(1)} 1156 C${c1x.toFixed(1)} 1200 ${c2x.toFixed(1)} ${(endy-20).toFixed(1)} ${endx.toFixed(1)} ${endy.toFixed(1)}" fill="none" stroke="${palette.stem}" stroke-width="${(.65+jitter(i)*1.4).toFixed(2)}" opacity=".75"/>`;
  for(let hair=0;hair<3;hair++){const t=.45+hair*.15,rx=x+(endx-x)*t,ry=1156+(endy-1156)*t;roots+=`<path d="M${rx.toFixed(1)} ${ry.toFixed(1)} q${side*(12+jitter(i+hair)*15)} 14 ${side*(25+jitter(i+hair+2)*22)} 25" fill="none" stroke="${palette.stem}" stroke-width=".5" opacity=".6"/>`;}
 }
 const text=labels?`<text x="512" y="70" text-anchor="middle" font-family="Georgia,serif" font-size="21" letter-spacing="4" fill="${palette.ink}">${data.year} · A YEAR IN LEAVES</text><path d="M468 1380 H556" stroke="${palette.light}" stroke-width="1" opacity=".65"/><text x="512" y="1418" text-anchor="middle" font-family="Georgia,serif" font-size="28" font-style="italic" fill="${palette.ink}">Grown from <tspan font-size="36" font-style="normal">${total.toLocaleString('en-US')}</tspan> contributions.</text><text x="512" y="1460" text-anchor="middle" font-family="Georgia,serif" font-size="22" fill="${palette.ink}">${active} active days · ${esc(data.source==='github'&&data.login?'@'+data.login+' on GitHub':'a botanical study')}</text><text x="512" y="1495" text-anchor="middle" font-family="sans-serif" font-size="13" letter-spacing="2" fill="${palette.ink}" opacity=".75">ONE LEAF FOR EACH DAY · ${data.year}</text>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536" role="img"><title>${esc(palette.name+' · '+data.year+' · '+data.login)}</title><desc>One leaf per date. Daily shades use GitHub contributionLevel. Larger leaves summarize a Sunday-based week using mean contribution counts. Future dates are faint. ${esc(data.source)} data as of ${data.asOf}.</desc><defs>${defs}<filter id="paper-grain-${theme}"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".035"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter></defs><rect width="1024" height="1536" fill="${palette.paper}"/><rect width="1024" height="1536" fill="${palette.paper}" filter="url(#paper-grain-${theme})"/>${text}<g stroke-linecap="round" stroke-linejoin="round">${stroke(model.stems,3.3)}${stroke(model.branches,1.1)}${roots}</g>${foliage}</svg>\n`;
}
