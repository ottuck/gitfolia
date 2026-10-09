import fs from 'node:fs';import path from 'node:path';import {fileURLToPath}from 'node:url';import assert from 'node:assert/strict';import pngjs from 'pngjs';
import {prepare,renderPixels,stages,makeOrder}from './engine.mjs';
const {PNG}=pngjs,root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),reports=[];
for(const name of ['ginkgo-complete-v2','fern-complete-v2']){
 const dir=path.join(root,'artwork'),meta=JSON.parse(fs.readFileSync(path.join(dir,name+'.json'))),source=PNG.sync.read(fs.readFileSync(path.join(dir,name+'.png'))),raw=fs.readFileSync(path.join(dir,name+'.mask')),labels=new Uint16Array(raw.length/2);for(let i=0;i<labels.length;i++)labels[i]=raw.readUInt16LE(i*2);
 const a=prepare(source.data,labels,meta);
 for(const mode of ['spread','leaf','random']){
  const s={commits:0,goal:3000,mode,seed:2026},order=makeOrder(meta.regions,mode,2026);assert.equal(new Set(order).size,meta.regions.length);assert.deepEqual(order,makeOrder(meta.regions,mode,2026));
  let previous=new Float32Array(meta.regions.length);
  for(const commits of [0,1,100,400,999,1000,1499,1500,1501,2500,2999,3000,50000]){
   const r=stages(a,{...s,commits});for(let i=0;i<previous.length;i++)assert.ok(r.amounts[i]>=previous[i],'commit growth must not uncolor a leaf');assert.ok(r.amounts.filter(v=>v>0&&v<1).length<=1,'only one leaf region may be partly painted');previous=r.amounts;
  }
  const complete=renderPixels(a,{...s,commits:3000});assert.equal(complete.complete,meta.regions.length);assert.equal(complete.active,-1);assert.deepEqual(Buffer.from(complete.data),source.data,'completion must be the complete colored artwork');
  const first=renderPixels(a,{...s,commits:1500}),again=renderPixels(a,{...s,commits:1500});assert.deepEqual(first.data,again.data,'same state must render identically');
 }
 const s={commits:1500,goal:3000,mode:'spread',seed:2026},before=renderPixels(a,s),after=renderPixels(a,{...s,commits:1501});let channels=0;
 for(let i=0;i<labels.length;i++)for(let c=0;c<4;c++){const j=i*4+c;if(!labels[i]||c===3)assert.equal(before.data[j],source.data[j],'background, trunk, roots and alpha must stay fixed');channels+=before.data[j]!==after.data[j];}
 assert.ok(channels>0,'one commit must change actual color');
 for(const goal of [500,1000,3000,5000,50000])assert.deepEqual(Buffer.from(renderPixels(a,{...s,commits:goal,goal}).data),source.data);
 reports.push({name,regions:meta.regions.length,oneCommitChangedChannels:channels,checks:['three order modes','no duplicates in order','stable state','monotonic leaf color','at most one partially painted region','all targets restore colored artwork','nonmask and alpha unchanged','one commit visible in pixel data']});
}
console.log(JSON.stringify(reports,null,2));
if(process.env.PROOF_REPORT)fs.writeFileSync(process.env.PROOF_REPORT,JSON.stringify({schema:2,report:reports},null,2));
