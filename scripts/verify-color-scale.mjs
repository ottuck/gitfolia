import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {THEMES} from './calendar.mjs';

export async function verifyColorScale(){
 const root=path.resolve(import.meta.dirname,'..'),report=[];
 for(const [theme,palette] of Object.entries(THEMES)){
  const sprites=JSON.parse(fs.readFileSync(path.join(root,'artwork/calendar',theme+'-sprites.json')));
  const paper=palette.paper.slice(1).match(/../g).map(x=>parseInt(x,16));
  const luminance=rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  const variants=[];
  for(let variant=0;variant<8;variant++){
   const images=await Promise.all([0,1,2,3,4].map(async level=>{
    const png=Buffer.from(sprites.tiles[`${variant}-${level}`].uri.split(',')[1],'base64');
    return sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   }));
   const mask=images[4].data,contrasts=images.map(({data,info})=>{
    assert.equal(data.length,mask.length);assert.equal(info.channels,4);
    let total=0,pixels=0;
    for(let j=0;j<data.length;j+=4){
     if(mask[j+3]<128)continue;
     const a=data[j+3]/255,rgb=paper.map((p,c)=>p*(1-a)+data[j+c]*a);
     total+=Math.abs(luminance(rgb)-luminance(paper));pixels++;
    }
    assert(pixels>100,'A visible leaf must be measured');return total/pixels;
   });
   for(let i=1;i<contrasts.length;i++)assert(contrasts[i]-contrasts[i-1]>=8,`${theme} variant ${variant}: adjacent levels must have visibly separated luminance contrast (${contrasts})`);
   variants.push({variant,contrast:contrasts.map(x=>Number(x.toFixed(2)))});
  }
  report.push({theme,variants});
 }
 return report;
}
if(process.argv[1]?.endsWith('verify-color-scale.mjs'))console.log(JSON.stringify(await verifyColorScale(),null,2));
