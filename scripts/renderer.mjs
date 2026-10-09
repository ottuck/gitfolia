export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const hash=i=>{let v=Math.imul(i^0x7f4a7c15,0x45d9f3b);v=Math.imul(v^(v>>>16),0x45d9f3b);return ((v^(v>>>16))>>>0)/4294967296;};
export function prepare(original,labels){
 const sketch=new Uint8ClampedArray(original),pixels=[];
 for(let i=0;i<labels.length;i++)if(labels[i]){
  pixels.push(i);const j=i*4,r=original[j],g=original[j+1],b=original[j+2],lum=r*.299+g*.587+b*.114;
  const edge=Math.abs(g-original[Math.max(0,i-1)*4+1]),ink=Math.min(65,edge*1.1)+(238-lum)*.16;
  sketch[j]=clamp(242-ink,0,255);sketch[j+1]=clamp(238-ink,0,255);sketch[j+2]=clamp(225-ink,0,255);
 }
 return {original,labels,sketch,pixels,random:Float32Array.from(pixels,hash)};
}
export function renderPixels(a,n,commits,goal,pulse=0){
 const units=clamp(commits/goal,0,1)*n,active=commits>0?Math.min(n-1,Math.ceil(units)-1):-1;
 const data=new Uint8ClampedArray(a.sketch);
 for(let k=0;k<a.pixels.length;k++){
  const i=a.pixels[k],j=i*4,region=a.labels[i]-1,amount=clamp(units-region,0,1);
  let mix=amount===1?1:amount===0?0:clamp((amount-a.random[k])/.16+.5,0,1);
  if(region===active&&pulse>0)mix=Math.max(mix,pulse*.65);
  for(let c=0;c<3;c++)data[j+c]=Math.round(a.sketch[j+c]+(a.original[j+c]-a.sketch[j+c])*mix);
 }
 return {data,active,units};
}
