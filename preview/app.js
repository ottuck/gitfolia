import {prepare,renderPixels,clamp} from './engine.mjs';
import {svgDocument} from './svg.mjs';
const $=id=>document.getElementById(id),art=[],assets=document.documentElement.dataset.assets||'.';let raf=0,running=false,ready=false;
const state=()=>({commits:clamp(Math.floor(Number($('commits').value)||0),0,50000),goal:clamp(Math.floor(Number($('goal').value)||1),1,50000),mode:$('mode').value,seed:2026});
for(const b of document.querySelectorAll('button'))b.disabled=true;
async function load(name,id){
 const meta=await fetch(assets+'/'+name+'.json').then(r=>r.json());
 const res=await fetch(assets+'/'+name+'.mask.gz'),raw=await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 const img=new Image();img.src=assets+'/'+meta.source;await img.decode();
 const canvas=$('art'+id);canvas.width=meta.width;canvas.height=meta.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
 return {name,id,canvas,ctx,...prepare(ctx.getImageData(0,0,meta.width,meta.height).data,new Uint16Array(raw),meta)};
}
function paint(a,s,pulse=0){const r=renderPixels(a,s,pulse);a.ctx.putImageData(new ImageData(r.data,a.meta.width,a.meta.height),0,0);a.canvas.dataset.commits=s.commits;a.canvas.dataset.complete=r.complete;a.canvas.dataset.active=r.active;
 $('count'+a.id).textContent=`${r.complete} / ${a.meta.regions.length} 잎 영역`;
 $('status'+a.id).textContent=r.progress===1?'모든 잎이 채워졌습니다':'잎의 윤곽을 따라 조금씩 채색 중';return r;
}
function render(pulse=0){if(!ready)return;const s=state();for(const a of art)paint(a,s,pulse);const progress=clamp(s.commits/s.goal,0,1);$('slider').max=s.goal;$('slider').value=Math.min(s.commits,s.goal);$('progressText').textContent=`${s.commits.toLocaleString()} / ${s.goal.toLocaleString()} 커밋 · ${(progress*100).toFixed(1)}%`;$('remaining').textContent=progress===1?(s.commits>s.goal?`완성 후 +${(s.commits-s.goal).toLocaleString()}`:'정원 완성'):`완성까지 ${(s.goal-s.commits).toLocaleString()} 커밋`;
 for(const b of document.querySelectorAll('[data-stage]'))b.classList.toggle('selected',Math.abs(progress-Number(b.dataset.stage))<.0001);$('live').textContent=$('progressText').textContent;
}
function cancel(){cancelAnimationFrame(raf);running=false;$('play').textContent='채색 과정 보기';}
function setCount(n){cancel();$('commits').value=Math.floor(clamp(n,0,50000));render();}
for(const id of ['commits','goal'])$(id).addEventListener('input',()=>{cancel();render();});$('mode').addEventListener('change',()=>{cancel();render();});$('slider').addEventListener('input',e=>setCount(Number(e.target.value)));
for(const id of ['commits','goal'])$(id).addEventListener('change',()=>{$(id).value=state()[id];render();});
for(const b of document.querySelectorAll('[data-stage]'))b.addEventListener('click',()=>setCount(state().goal*Number(b.dataset.stage)));
$('add').addEventListener('click',()=>{setCount(state().commits+1);const start=performance.now();const tick=()=>{const t=(performance.now()-start)/1500;if(t>=1){render();return;}render(Math.sin(t*Math.PI)**2);raf=requestAnimationFrame(tick);};tick();});
$('play').addEventListener('click',()=>{if(running){cancel();render();return;}cancel();running=true;$('play').textContent='일시 정지';const start=performance.now(),goal=state().goal;const tick=()=>{if(!running)return;const t=clamp((performance.now()-start)/14000,0,1);$('commits').value=Math.floor(t*goal);render();if(t<1)raf=requestAnimationFrame(tick);else cancel();};tick();});
for(const b of document.querySelectorAll('[data-export]'))b.addEventListener('click',()=>{cancel();const a=art[Number(b.dataset.export)],s=state(),r=paint(a,s),base=a.canvas.toDataURL('image/webp',.9);let overlay=null;
 if(r.active>=0){const c=document.createElement('canvas');c.width=a.meta.width;c.height=a.meta.height;const ctx=c.getContext('2d'),layer=ctx.createImageData(c.width,c.height);for(const i of a.pixels)if(a.labels[i]-1===r.active){const j=i*4;for(let k=0;k<4;k++)layer.data[j+k]=a.original[j+k];}ctx.putImageData(layer,0,0);overlay=c.toDataURL('image/webp',.9);}
 const svg=svgDocument({...a.meta,base,overlay,title:`${a.id===0?'Ginkgo':'Fern'} · ${s.commits}/${s.goal} commits · ${s.mode}`}),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),link=document.createElement('a');link.href=url;link.download=a.name+'-'+s.commits+'.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
try{art.push(...await Promise.all([load('ginkgo-complete-v2',0),load('fern-complete-v2',1)]));ready=true;render();for(const b of document.querySelectorAll('button'))b.disabled=false;}catch(e){$('progressText').textContent='불러오기 실패: '+e.message;console.error(e);}
