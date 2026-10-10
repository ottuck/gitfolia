import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {THEMES} from './calendar.mjs';
const root=path.resolve(import.meta.dirname,'..'),folder=path.join(root,'artwork/calendar');
for(const [theme,palette]of Object.entries(THEMES)){
 const source=path.join(folder,theme+'-atlas.png'),meta=await sharp(source).metadata(),cw=Math.floor(meta.width/4),ch=Math.floor(meta.height/2),tiles={};
 for(let i=0;i<8;i++){
  const {data,info}=await sharp(source).extract({left:(i%4)*cw,top:Math.floor(i/4)*ch,width:cw,height:ch}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=cw,right=0,top=ch,bottom=0,transparent=0;for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const a=data[(y*cw+x)*4+3];if(a<10)transparent++;if(a>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
  if(transparent<cw*ch*.2||right<=left)throw new Error('Atlas requires isolated transparent leaves: '+theme+' tile '+i);
  left=Math.max(0,left-2);top=Math.max(0,top-2);right=Math.min(cw-1,right+2);bottom=Math.min(ch-1,bottom+2);
  const sprite=await sharp(data,{raw:info}).extract({left,top,width:right-left+1,height:bottom-top+1}).resize({width:144}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width,height}=sprite.info,original=sprite.data,sketch=Buffer.alloc(original.length),ink=palette.dark?[165,181,176]:[126,112,89];
  const lum=j=>original[j]*.299+original[j+1]*.587+original[j+2]*.114;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const j=(y*width+x)*4,a=original[j+3];if(!a)continue;
   const neighbors=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].map(([xx,yy])=>xx<0||yy<0||xx>=width||yy>=height?-1:(yy*width+xx)*4);
   const edge=Math.max(...neighbors.map(k=>k<0?a:Math.abs(a-original[k+3])))/255,vein=Math.max(...neighbors.filter(k=>k>=0).map(k=>Math.abs(lum(j)-lum(k))))/255;
   sketch[j]=ink[0];sketch[j+1]=ink[1];sketch[j+2]=ink[2];sketch[j+3]=Math.round(a*Math.min(1,.045+edge*2.7+vein*2.5));
  }
  for(let level=0;level<=4;level++){
   const buffer=level===0?sketch:Buffer.from(original),opacity=[0,.33,.51,.73,1][level];
   if(level)for(let j=3;j<buffer.length;j+=4)buffer[j]=Math.round(buffer[j]*opacity);
   const png=await sharp(buffer,{raw:{width,height,channels:4}}).png({palette:true,quality:95,effort:10}).toBuffer();tiles[`${i}-${level}`]={width,height,uri:'data:image/png;base64,'+png.toString('base64')};
  }
 }
 fs.writeFileSync(path.join(folder,theme+'-sprites.json'),JSON.stringify({theme,tiles})+'\n');console.log(theme+': '+Object.keys(tiles).length+' sprites');
}
