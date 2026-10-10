import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {normalizeCalendar} from './calendar.mjs';
export async function fetchCalendar(login,year,asOf=new Date().toISOString().slice(0,10)){
 if(!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(login))throw new Error('Invalid GitHub login');
 const end=asOf<`${year}-12-31`?asOf:`${year}-12-31`;if(end<`${year}-01-01`)throw new Error('Cannot fetch a future year');
 const body={query:'query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){contributionCalendar{weeks{contributionDays{date contributionCount contributionLevel}}}}}}',variables:{login,from:`${year}-01-01T00:00:00Z`,to:end+'T23:59:59Z'}};
 let payload;const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
 if(token){const response=await fetch('https://api.github.com/graphql',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','User-Agent':'botanical-readme-poc'},body:JSON.stringify(body)});if(!response.ok)throw new Error(`GitHub request failed (${response.status})`);payload=await response.json();}
 else{const result=spawnSync('gh',['api','graphql','--input','-'],{input:JSON.stringify(body),encoding:'utf8',windowsHide:true});if(result.status!==0)throw new Error('gh GraphQL request failed: '+(result.stderr||'Authenticate with gh auth login'));payload=JSON.parse(result.stdout);}
 if(payload.errors)throw new Error(payload.errors.map(e=>e.message).join('; '));
 const calendar=payload.data?.user?.contributionsCollection?.contributionCalendar;if(!calendar)throw new Error('No contribution calendar returned');
 return normalizeCalendar(calendar.weeks.flatMap(w=>w.contributionDays),{year,asOf:end,login,source:'github'});
}
if(process.argv[1]?.endsWith('fetch-calendar.mjs')){const [login='ottuck',year='2026',output='images/calendar-data.json']=process.argv.slice(2);const data=await fetchCalendar(login,Number(year));fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n');console.log(`${login}: ${data.days.length} daily records (${data.asOf})`);}
