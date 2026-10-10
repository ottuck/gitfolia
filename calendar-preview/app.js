import {THEMES,calendarSvg,demoCalendar,weeksForCalendar} from '../scripts/calendar.mjs';
const $=id=>document.getElementById(id),sprites={},svgStrings={},themes=Object.keys(THEMES);let snapshot,data;
for(const control of document.querySelectorAll('input,select,button'))control.disabled=true;
const year=()=>Math.min(2100,Math.max(2000,Math.floor(Number($('year').value)||2026)));
const dateIndex=()=>Math.max(0,data.days.findIndex(d=>d.date===$('date').value));
function selectDate(date){
 const day=data.days.find(d=>d.date===date)||data.days[0];$('date').value=day.date;$('day-slider').value=data.days.indexOf(day);$('count').value=day.count??0;
 const isDemo=data.source==='demo';$('count').disabled=!isDemo||day.future;$('add').disabled=!isDemo||day.future;
 const week=weeksForCalendar(data).find(w=>w.days.some(d=>d.date===day.date));
 $('selection').textContent=`${day.date} · ${day.future?'미래 날짜':day.count+' 기여 · 색 단계 '+day.level} · 주 평균 ${week.mean===null?'미래':week.mean.toFixed(1)+' 기여/일'}`;
 for(const theme of themes){for(const item of $(theme).querySelectorAll('[data-selected]'))item.removeAttribute('data-selected');$(theme).querySelector(`[data-date="${day.date}"]`)?.setAttribute('data-selected','true');}
}
function render(){
 for(const theme of themes){const svg=calendarSvg(data,{theme,sprites:sprites[theme],weekly:$('weekly').checked});svgStrings[theme]=svg;$(theme).innerHTML=svg;document.querySelector(`[data-theme="${theme}"] .leaf-count`).textContent=`${data.days.length}일 · ${data.days.filter(d=>d.count>0).length} 활동일`;}
 $('date').min=data.days[0].date;$('date').max=data.days.at(-1).date;$('day-slider').max=data.days.length-1;
 $('data-status').textContent=data.source==='github'?`@${data.login} 실제 기록 · ${data.asOf} UTC`:`${data.year}년 예시 · ${data.days.length}개 일별 잎`;
 selectDate($('date').value);
}
function setData(){
 if($('source').value==='github'){data=structuredClone(snapshot);$('year').value=data.year;}
 else{const y=year();$('year').value=y;data=demoCalendar(y,`${y}-12-31`,$('source').value);}
 render();
}
function changeCount(count){
 const day=data.days[dateIndex()];if(data.source!=='demo'||day.future)return;
 day.count=Math.max(0,Math.min(1000000000,Math.floor(count)||0));day.level=day.count===0?0:Math.min(4,Math.ceil(day.count/12));render();
}
$('source').addEventListener('change',setData);$('year').addEventListener('input',()=>{const y=Number($('year').value);if(!/^\d{4}$/.test($('year').value)||y<2000||y>2100)return;if($('source').value==='github')$('source').value='mixed';setData();});$('year').addEventListener('change',()=>{$('year').value=data.year;});$('weekly').addEventListener('change',render);
$('date').addEventListener('input',()=>{if(data.days.some(d=>d.date===$('date').value))selectDate($('date').value);});$('date').addEventListener('change',()=>selectDate($('date').value));$('day-slider').addEventListener('input',e=>selectDate(data.days[Number(e.target.value)].date));$('count').addEventListener('input',()=>changeCount(Number($('count').value)));$('add').addEventListener('click',()=>changeCount((data.days[dateIndex()].count||0)+1));
for(const theme of themes)$(theme).addEventListener('click',e=>{const leaf=e.target.closest('[data-date]');if(leaf)selectDate(leaf.dataset.date);});
for(const button of document.querySelectorAll('[data-export]'))button.addEventListener('click',()=>{const theme=button.dataset.export,url=URL.createObjectURL(new Blob([svgStrings[theme]],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download=`botanical-${theme}-${data.year}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);});
try{
 const values=await Promise.all([fetch('../images/calendar-data.json').then(r=>{if(!r.ok)throw new Error('Missing calendar snapshot');return r.json();}),...themes.map(theme=>fetch('../artwork/calendar/'+theme+'-sprites.json').then(r=>{if(!r.ok)throw new Error('Missing leaf sprites');return r.json();}))]);
 snapshot=values[0];themes.forEach((theme,i)=>sprites[theme]=values[i+1]);for(const control of document.querySelectorAll('input,select,button'))control.disabled=false;setData();
}catch(error){$('data-status').textContent='불러오기 실패: '+error.message;console.error(error);}
