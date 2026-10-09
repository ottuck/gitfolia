export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function hash(i,seed=2026){let v=Math.imul(i^seed,0x45d9f3b);v=Math.imul(v^(v>>>16),0x45d9f3b);return ((v^(v>>>16))>>>0)/4294967296;}
export function makeOrder(regions,mode='spread',seed=2026){
 const remaining=new Set(regions.map((_,i)=>i)),order=[];
 if(mode==='random')return [...remaining].sort((a,b)=>hash(a+1,seed)-hash(b+1,seed));
 const dist=(a,b)=>(a.cx-b.cx)**2+(a.cy-b.cy)**2;
 const large=regions.map((r,i)=>({r,i})).filter(x=>x.r.pixels>=200);
 const start=large.sort((a,b)=>dist(a.r,{cx:512,cy:700})-dist(b.r,{cx:512,cy:700}))[0]?.i??0;
 const fronts=[start];
 if(mode==='spread')for(let f=1;f<4;f++){
  let best=start,score=-1;for(const {r,i}of large){const d=Math.min(...fronts.map(j=>dist(r,regions[j])));if(d>score){best=i;score=d;}}
  fronts.push(best);
 }
 for(const i of fronts)if(remaining.delete(i))order.push(i);
 let turn=0;
 while(remaining.size){
  const f=turn++%fronts.length,last=regions[fronts[f]];
  const candidates=[...remaining].map(i=>({i,d:dist(last,regions[i])})).sort((a,b)=>a.d-b.d).slice(0,mode==='spread'?6:1);
  const selected=candidates.map(c=>({...c,score:(Math.sqrt(c.d)+12)*(0.75+hash(c.i+1,seed)*.5)})).sort((a,b)=>a.score-b.score)[0].i;
  remaining.delete(selected);order.push(selected);fronts[f]=selected;
 }
 return order;
}
export function prepare(original,labels,meta){
 const sketch=new Uint8ClampedArray(original),pixels=[],w=meta.width,h=meta.height;
 const lum=i=>original[i*4]*.299+original[i*4+1]*.587+original[i*4+2]*.114;
 for(let i=0;i<labels.length;i++)if(labels[i]){
  pixels.push(i);const j=i*4,x=i%w,y=Math.floor(i/w),l=lum(i);
  const edge=Math.max(Math.abs(l-lum(x>0?i-1:i)),Math.abs(l-lum(x<w-1?i+1:i)),Math.abs(l-lum(y>0?i-w:i)),Math.abs(l-lum(y<h-1?i+w:i)));
  const ink=clamp(Math.max(edge*.82,(245-l)*.09),0,105),grain=(hash(i,417)-.5)*2;
  sketch[j]=244-ink+grain;sketch[j+1]=238-ink+grain;sketch[j+2]=222-ink+grain;
 }
 return {original,labels,meta,sketch,pixels,orders:new Map()};
}
export function stages(a,{commits,goal,mode='spread',seed=2026}){
 const key=mode+':'+seed;if(!a.orders.has(key))a.orders.set(key,makeOrder(a.meta.regions,mode,seed));
 const order=a.orders.get(key),weights=a.meta.regions.map(r=>Math.max(1,Math.sqrt(r.pixels))),total=weights.reduce((s,v)=>s+v,0),budget=clamp(commits/goal,0,1)*total;
 const amounts=new Float32Array(weights.length);let spent=0,active=-1,complete=0;
 if(commits>=goal){amounts.fill(1);return {amounts,active:-1,complete:weights.length,progress:1,order};}
 for(const i of order){const v=clamp((budget-spent)/weights[i],0,1);amounts[i]=v;if(v>=1)complete++;else if(v>0)active=i;spent+=weights[i];}
 return {amounts,active,complete,progress:clamp(commits/goal,0,1),order};
}
export function renderPixels(a,s,pulse=0){
 const stage=stages(a,s),data=new Uint8ClampedArray(a.sketch);
 for(const i of a.pixels){const j=i*4,r=a.labels[i]-1;let amount=stage.amounts[r];if(r===stage.active)amount=clamp(amount+pulse*.14,0,1);
  for(let c=0;c<3;c++)data[j+c]=Math.round(a.sketch[j+c]+(a.original[j+c]-a.sketch[j+c])*amount);
 }
 return {data,...stage};
}
