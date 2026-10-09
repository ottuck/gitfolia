import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {prepare,renderPixels} from './renderer.mjs';
const {PNG}=pngjs,root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const commits=Number(process.argv[2]??'1000'),goal=Number(process.argv[3]??'3000');
if(!Number.isInteger(commits)||commits<0||commits>20000||!Number.isInteger(goal)||goal<1||goal>20000)throw new Error('Expected integer count 0..20000 and goal 1..20000');
const out=path.join(root,'images');fs.mkdirSync(out,{recursive:true});
const results=[];
for(const [name,label] of [['01-sketch-bloom','은행나무'],['02-watercolor-fern','양치식물']]){
 const meta=JSON.parse(fs.readFileSync(path.join(root,'artwork',name+'.json'))),source=PNG.sync.read(fs.readFileSync(path.join(root,'artwork',name+'.png')));
 const raw=fs.readFileSync(path.join(root,'artwork',name+'.mask')),labels=new Uint16Array(raw.length/2);
 for(let i=0;i<labels.length;i++)labels[i]=raw.readUInt16LE(i*2);
 if(labels.length!==source.width*source.height)throw new Error('Mask size mismatch');
 const a=prepare(source.data,labels),{data,active,units}=renderPixels(a,meta.regions.length,commits,goal);
 const base=PNG.sync.write({width:source.width,height:source.height,data:Buffer.from(data)});
 const layer=Buffer.alloc(data.length);
 // The current region receives a gentle color pulse. No code runs in the README image.
 if(active>=0&&units<meta.regions.length)for(const i of a.pixels)if(labels[i]-1===active){const j=i*4;source.data.copy(layer,j,j,j+4);}
 const overlay=PNG.sync.write({width:source.width,height:source.height,data:layer});
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${source.width}" height="${source.height}" viewBox="0 0 ${source.width} ${source.height}"><title>${label}: ${commits} demo commits / ${goal}</title><desc>Static botanical artwork with a subtle repeating pulse on the active paint region. All images are embedded; no scripts or external resources.</desc><image href="data:image/png;base64,${base.toString('base64')}" width="100%" height="100%"/><image href="data:image/png;base64,${overlay.toString('base64')}" width="100%" height="100%" opacity="0"><animate attributeName="opacity" values="0;0.5;0" dur="3s" repeatCount="indefinite"/></image></svg>\n`;
 fs.writeFileSync(path.join(out,name+'.svg'),svg);
 results.push({name,commits,goal,regions:meta.regions.length,complete:Math.floor(units),active,bytes:Buffer.byteLength(svg),sha256:createHash('sha256').update(svg).digest('hex')});
}
fs.writeFileSync(path.join(out,'state.json'),JSON.stringify({commits,goal,images:results},null,2)+'\n');
const readme=`# Botanical README PoC

보태니컬 그림이 **GitHub README에서 표시되고 움직이며, Actions로 갱신되는지** 확인하는 공개 시험 저장소입니다.

**시험 수치: ${commits.toLocaleString('en-US')}커밋 / 완전 채색 기준: ${goal.toLocaleString('en-US')}커밋**

<table>
  <tr><th>은행나무 · 부분 채색</th><th>양치식물 · 촘촘한 채색</th></tr>
  <tr><td><img src="images/01-sketch-bloom.svg" width="360" alt="은행나무 채색: ${commits} 시험 커밋" /></td><td><img src="images/02-watercolor-fern.svg" width="360" alt="양치식물 채색: ${commits} 시험 커밋" /></td></tr>
</table>

현재 채색 중인 작은 영역이 약 3초마다 은은하게 강조됩니다. 위 두 이미지의 주소는 갱신 후에도 같습니다.

## 검증 범위

- 저장소에 SVG를 업로드하고 README의 상대 경로로 표시합니다.
- 이미지 안에는 JavaScript와 외부 이미지 요청이 없습니다. PNG를 내장한 SVG와 SMIL 애니메이션입니다.
- GitHub Actions의 수동 실행으로 그림을 다시 만들고 README 및 이미지에 반영합니다.
- <code>images/state.json</code>에 입력 수치, 완료 영역, 이미지 해시를 기록합니다.

## 직접 갱신

Actions → **Render botanical README** → **Run workflow**에서 시험 커밋 수와 완성 기준을 입력하세요.

로컬 실행:

\`\`\`sh
npm ci
npm run render -- 1000 3000
\`\`\`

## 현재 그림의 한계

이 저장소는 표시·업로드·갱신 검증용입니다. 입력한 수치는 실제 GitHub 기여 통계가 아닙니다. 사용자 활동 집계와 커밋 발생 시 실행 연결은 후속 단계입니다.

기존 PoC의 아래에서 위로 채워지는 자동 마스크를 그대로 사용합니다. 잎별 또는 랜덤 분산 채색은 아직 구현하지 않았습니다. 은행나무 원본의 연필 잎은 완료 상태에도 남습니다. 완성품은 모든 잎의 선화·채색·마스크를 분리한 소재가 필요합니다.
`;
fs.writeFileSync(path.join(root,'README.md'),readme);
console.log(JSON.stringify(results,null,2));
