import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const [base, login = 'ottuck', outputArg = 'test-output/live'] = process.argv.slice(2);
if (!base) throw new Error('Usage: npm run verify:live -- https://YOUR-WORKER.workers.dev [login] [output-directory]');
if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(login)) throw new Error('Invalid login');
const output = path.resolve(outputArg);
const url = new URL(`/garden/${login}.svg`, base);
const start = performance.now();
const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
assert.equal(response.status, 200, 'Worker must return the real image');
assert.match(response.headers.get('content-type'), /^image\/svg\+xml/);
const svg = await response.text(), year = Number(response.headers.get('x-garden-year'));
const asOf = response.headers.get('x-garden-as-of'), elapsedMs = performance.now() - start;
assert(/^\d{4}-\d{2}-\d{2}$/.test(asOf));
const request = {
  query: 'query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){contributionCalendar{weeks{contributionDays{date contributionCount contributionLevel}}}}}}',
  variables: { login, from: `${year}-01-01T00:00:00Z`, to: `${asOf}T23:59:59Z` }
};
let payload;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (token) {
  const apiResponse = await fetch('https://api.github.com/graphql', { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'botanical-live-verification' },
    body: JSON.stringify(request), signal: AbortSignal.timeout(20_000) });
  assert(apiResponse.ok, 'Independent GitHub request must succeed');
  payload = await apiResponse.json();
} else {
  const result = spawnSync('gh', ['api', 'graphql', '--input', '-'], {
    input: JSON.stringify(request), encoding: 'utf8', windowsHide: true, timeout: 20_000
  });
  assert.equal(result.status, 0, 'Independent GitHub request must succeed');
  payload = JSON.parse(result.stdout);
}
assert(!payload.errors?.length, 'GitHub must return a complete calendar');
const days = payload.data.user.contributionsCollection.contributionCalendar.weeks.flatMap(week => week.contributionDays);
const byDate = new Map(days.map(day => [day.date, day]));
assert.equal(byDate.size, days.length);
const levels = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];
const sprites = JSON.parse(fs.readFileSync(new URL('../../artwork/calendar/watercolor-sprites.json', import.meta.url)));
const symbols = new Map([...svg.matchAll(/<symbol id="([^"]+)"[^>]*><image href="([^"]+)"/g)].map(m => [m[1], m[2]]));
const leaves = [...svg.matchAll(/<g data-kind="day" ([^>]+)><title>[^<]*<\/title><use href="#([^"]+)"/g)];
const dates = [];
for (let date = new Date(`${year}-01-01T00:00:00Z`); date.getUTCFullYear() === year; date.setUTCDate(date.getUTCDate() + 1)) dates.push(date.toISOString().slice(0, 10));
assert.equal(leaves.length, dates.length);
for (const [index, date] of dates.entries()) {
  const future = date > asOf, day = byDate.get(date), level = future ? 0 : levels.indexOf(day.contributionLevel);
  const [_, attributes, reference] = leaves[index];
  assert(attributes.includes(`data-date="${date}"`), date);
  assert(attributes.includes(`data-count="${future ? 'future' : day.contributionCount}"`), date + ' count');
  assert(attributes.includes(`data-level="${future ? 'future' : level}"`), date + ' level');
  assert(attributes.includes(`opacity="${future ? '0.3' : '1'}"`), date + ' opacity');
  assert.equal(reference, `leaf-watercolor-${index % 8}-${level}`, date + ' selected paint');
  assert.equal(symbols.get(reference), sprites.tiles[`${index % 8}-${level}`].uri, date + ' actual PNG');
}
const weeks = [];
for (const date of dates) {
  if (!weeks.length || new Date(date + 'T00:00:00Z').getUTCDay() === 0) weeks.push([]);
  weeks.at(-1).push(date);
}
const means = weeks.map(week => {
  const past = week.filter(date => date <= asOf);
  return past.length ? past.reduce((sum, date) => sum + byDate.get(date).contributionCount, 0) / past.length : null;
});
const maximum = Math.max(0, ...means.filter(value => value !== null));
const summaries = [...svg.matchAll(/<g data-kind="week" ([^>]+)><title>([^<]*)<\/title><use href="#([^"]+)"/g)];
assert.equal(summaries.length, weeks.length);
for (const [index, mean] of means.entries()) {
  const level = mean === null || mean === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(mean / maximum * 4)));
  assert.equal(summaries[index][3], `leaf-watercolor-${index % 8}-${level}`);
  if (mean !== null) assert(summaries[index][2].includes(mean.toFixed(1) + ' contributions/day'));
}
const total = days.filter(day => day.date >= `${year}-01-01` && day.date <= asOf).reduce((sum, day) => sum + day.contributionCount, 0);
assert(svg.includes(total.toLocaleString('en-US') + '</tspan> contributions.'));
assert(!svg.includes('<script'));
const repeated = await fetch(url), repeatedSvg = await repeated.text();
assert.equal(repeated.status, 200);
assert.equal(repeatedSvg, svg, 'The next request must reuse the same stored artwork');
const conditional = await fetch(url, { headers: { 'If-None-Match': response.headers.get('etag') } });
assert.equal(conditional.status, 304);
await conditional.text();
const report = {
  verifiedAt: new Date().toISOString(), url: String(url), login, year, asOf,
  updatedAt: response.headers.get('x-garden-updated-at'),
  totalContributions: total, activeDays: days.filter(day => day.date >= `${year}-01-01` && day.date <= asOf && day.contributionCount > 0).length,
  dailyLeavesChecked: leaves.length, weeklyLeavesChecked: summaries.length, mismatches: 0,
  sha256: createHash('sha256').update(svg).digest('hex'), bytes: Buffer.byteLength(svg),
  firstRequestElapsedMs: Math.round(elapsedMs), cachedResponseMatches: true, conditionalStatus: conditional.status,
  source: 'Fresh independent GitHub GraphQL query using the verifier authentication scope'
};
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'watercolor.svg'), svg);
fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
