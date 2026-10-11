import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import sharp from 'sharp';
import {prepare,renderPixels} from './engine.mjs';
import {svgDocument} from './svg.mjs';
const {PNG}=pngjs,root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const commits=Number(process.argv[2]??'1500'),goal=Number(process.argv[3]??'3000'),mode=process.argv[4]??'spread',seed=Number(process.argv[5]??'2026');
if(!Number.isInteger(commits)||commits<0||commits>50000||!Number.isInteger(goal)||goal<1||goal>50000||!['spread','leaf','random'].includes(mode)||!Number.isInteger(seed))throw new Error('Invalid count, goal, order, or seed');
const out=path.join(root,'images');fs.mkdirSync(out,{recursive:true});
const results=[];
for(const [name,key,label]of [['ginkgo-complete-v2','01-sketch-bloom','은행나무'],['fern-complete-v2','02-watercolor-fern','양치식물']]){
 const meta=JSON.parse(fs.readFileSync(path.join(root,'artwork',name+'.json'))),source=PNG.sync.read(fs.readFileSync(path.join(root,'artwork',name+'.png')));
 const raw=fs.readFileSync(path.join(root,'artwork',name+'.mask')),labels=new Uint16Array(raw.length/2);for(let i=0;i<labels.length;i++)labels[i]=raw.readUInt16LE(i*2);
 if(labels.length!==source.width*source.height)throw new Error('Mask size mismatch');
 const a=prepare(source.data,labels,meta),r=renderPixels(a,{commits,goal,mode,seed});
 const base=await sharp(Buffer.from(r.data),{raw:{width:meta.width,height:meta.height,channels:4}}).webp({quality:90,effort:5}).toBuffer();
 let overlay=null;
 if(r.active>=0){const layer=Buffer.alloc(r.data.length);for(const i of a.pixels)if(labels[i]-1===r.active){const j=i*4;source.data.copy(layer,j,j,j+4);}overlay=await sharp(layer,{raw:{width:meta.width,height:meta.height,channels:4}}).webp({quality:90,effort:5}).toBuffer();}
 const svg=svgDocument({...meta,base:'data:image/webp;base64,'+base.toString('base64'),overlay:overlay?'data:image/webp;base64,'+overlay.toString('base64'):null,title:`${label} · ${commits}/${goal} commits · ${mode} · ${seed}`});
 fs.writeFileSync(path.join(out,key+'.svg'),svg);
 results.push({name,key,label,commits,goal,mode,seed,regions:meta.regions.length,complete:r.complete,active:r.active,bytes:Buffer.byteLength(svg),sha256:createHash('sha256').update(svg).digest('hex')});
}
fs.writeFileSync(path.join(out,'state.json'),JSON.stringify({schema:2,commits,goal,mode,seed,images:results},null,2)+'\n');
const imgs=results.map(r=>`images/${r.key}.svg?v=${r.sha256.slice(0,12)}`),urls=results.map(r=>`https://raw.githubusercontent.com/ottuck/gitfolia/main/images/${r.key}.svg?v=${r.sha256.slice(0,12)}`);
const ratio=Math.min(100,commits/goal*100).toFixed(1),status=commits>=goal?'모든 잎이 채워졌습니다':`완성까지 ${(goal-commits).toLocaleString('en-US')}커밋`;
const modeLabel={spread:'여러 지점에서 퍼지기',leaf:'가까운 잎 하나씩',random:'랜덤 분산'}[mode];
const readme=`# Botanical garden

커밋이 쌓일수록 잎에 색이 깃드는 보태니컬 포스터입니다. 현재는 **비공개 개발 단계**입니다.

**${seed}년 · 시험 ${commits.toLocaleString('en-US')} / 목표 ${goal.toLocaleString('en-US')}커밋 · ${ratio}% · ${status}**

채색 방식: ${modeLabel}

<table><tr><th>은행나무 · Ginkgo biloba</th><th>양치식물 · Fern study</th></tr><tr><td><img src="${imgs[0]}" width="360" alt="은행나무 ${commits}/${goal} 채색" /></td><td><img src="${imgs[1]}" width="360" alt="양치식물 ${commits}/${goal} 채색" /></td></tr></table>

## 이번 버전

- 모든 잎이 채색된 은행나무 완성 원화를 사용합니다. 목표에 도달하면 두 그림 모두 완성 원화가 됩니다.
- 잎의 색 윤곽을 따라 만든 영역이 전체 잎 단위로 서서히 채워집니다. 맞붙은 잎 일부는 묶이거나 나뉠 수 있습니다.
- 여러 지점에서 퍼지기 / 가까운 잎 하나씩 / 랜덤 분산을 선택할 수 있습니다. 같은 수치·순서·연도는 같은 그림을 만듭니다.
- 목표에 도달한 뒤에는 완성 상태를 유지합니다. 한 해의 완성 기준은 설정한 목표 커밋 수입니다.
- SVG 안의 이미지는 WebP로 압축합니다. 스크립트나 외부 이미지 요청은 없습니다. 현재 채색 중인 작은 잎 영역만 6초 주기로 은은하게 강조됩니다.
- 이미지 해시로 URL 버전 값을 바꿔 이전 그림의 캐시를 피합니다.

## 실행

Actions → **Render botanical README**에서 수치, 목표, 순서를 선택합니다. 실행 후 이미지와 README가 자동 커밋됩니다.

로컬:

\`\`\`sh
npm ci --ignore-scripts
npm run render -- 1500 3000 spread 2026
python -m http.server 8767 --bind 127.0.0.1
\`\`\`

브라우저에서 http://127.0.0.1:8767/preview/ 를 열면 슬라이더, 완성 상태, 채색 순서를 비교할 수 있습니다.

## 다음 연결

현재 수치는 시험 입력입니다. 실제 사용자 활동 집계와 커밋 발생에 따른 실행은 아직 연결하지 않았습니다. 목표를 바꾸면 진행률도 바뀝니다. 미채색 상태는 원화에서 추출한 연필 표현이며 별도 수작업 선화는 아닙니다.

공개 전에는 [프로필 삽입 코드](PROFILE-EMBED.md)의 URL을 사용한 공개 프로필 표시가 제한됩니다.
`;
fs.writeFileSync(path.join(root,'README.md'),readme);
const profile=`# 프로필 삽입 코드

현재 저장소는 비공개입니다. 완성 후 공개 전환한 다음 아래 코드를 사용할 수 있습니다. 현재 그림은 ${commits}/${goal}, ${mode}, ${seed} 상태입니다.

\`\`\`markdown
<img src="${urls[0]}" width="360" alt="Botanical garden · Ginkgo" />
\`\`\`

\`\`\`markdown
<img src="${urls[1]}" width="360" alt="Botanical garden · Fern" />
\`\`\`

이미지가 바뀌면 이 문서의 버전 값도 갱신됩니다. 실제 프로필에 자동 연결할 때는 프로필 README의 버전 값도 함께 갱신해야 합니다. 열린 README가 커밋 발생을 실시간으로 감지하는 방식은 아닙니다.
`;
fs.writeFileSync(path.join(root,'PROFILE-EMBED.md'),profile);
console.log(JSON.stringify(results,null,2));
