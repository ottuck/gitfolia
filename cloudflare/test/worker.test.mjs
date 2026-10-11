import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { Miniflare, convertV4MiniflareOptions, Response } from 'miniflare';
import { BREEZE_REVISION } from '../../scripts/calendar.mjs';

const DAY = 86_400_000;
const schema = fs.readFileSync(new URL('../migrations/0001_gardens.sql', import.meta.url), 'utf8');
const sprites = JSON.parse(fs.readFileSync(new URL('../../artwork/calendar/watercolor-sprites.json', import.meta.url)));
const levels = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];

function apiDays(from, to, mode = 'regression') {
  const records = [];
  for (let date = new Date(from); date <= new Date(to); date.setUTCDate(date.getUTCDate() + 1)) {
    const day = date.toISOString().slice(0, 10), suffix = day.slice(5);
    // Deliberately includes 70 contributions at level 1: trust GitHub's level, not a count threshold.
    const anchors = { '01-01': [1, 1], '01-03': [70, 1], '02-29': [12, 2],
      '06-30': [25, 3], '12-20': [45, 4], '12-24': [80, 4], '12-31': [95, 4] };
    let [count, level] = mode === 'dense' ? [30 + records.length % 61, 4]
      : mode === 'year-end' ? (suffix >= '12-20' && suffix !== '12-25' ? [40 + Number(suffix.slice(3)) - 20, 4] : [0, 0])
      : anchors[suffix] || [0, 0];
    if (mode === 'changed' && suffix === '01-01') [count, level] = [49, 4];
    records.push({ date: day, contributionCount: count, contributionLevel: levels[level] });
  }
  return records;
}

async function harness(t, { token = 'fake-test-token', mode = 'regression' } = {}) {
  const state = { mode, calls: [], delay: false, status: 200 };
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    scriptPath: new URL('../dist/index.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    compatibilityDate: '2026-10-11',
    d1Databases: ['DB'],
    r2Buckets: ['GARDENS'],
    bindings: { GITHUB_TOKEN: token, REFRESH_BATCH_SIZE: '4' },
    cf: false,
    outboundService: async request => {
      assert.equal(request.url, 'https://api.github.com/graphql', 'Tests must never access another service');
      assert.equal(request.method, 'POST');
      assert.equal(request.headers.get('Authorization'), 'Bearer fake-test-token');
      const body = await request.json();
      state.calls.push(body.variables);
      if (state.delay) await new Promise(resolve => setTimeout(resolve, 50));
      if (state.status !== 200) return new Response('Upstream failure', { status: state.status,
        headers: state.status === 302 ? { Location: 'https://unexpected.test/' } : {} });
      if (state.mode === 'not-found') return Response.json({ data: { user: null }, errors: [{ type: 'NOT_FOUND' }] });
      const days = apiDays(body.variables.from, body.variables.to, state.mode);
      if (state.mode === 'incomplete') days.splice(0, 1);
      return Response.json({ data: { user: {
        login: body.variables.login,
        contributionsCollection: { contributionCalendar: { weeks: [{ contributionDays: days }] } }
      } } });
    }
  }));
  t.after(() => mf.dispose());
  const { DB: db, GARDENS: bucket } = await mf.getBindings();
  // Run exactly the same SQL migration used in deployment.
  for (const statement of schema.split(';').filter(sql => sql.trim())) await db.prepare(statement).run();
  const worker = await mf.getWorker();
  return { mf, db, bucket, state,
    get: (path, options) => mf.dispatchFetch('https://garden.test' + path, options),
    cron: now => worker.scheduled({ scheduledTime: now, cron: '*/10 * * * *' }) };
}

function checkLeaves(svg, variables, mode) {
  const year = Number(variables.from.slice(0, 4));
  const records = apiDays(variables.from, variables.to, mode);
  const byDate = new Map(records.map(day => [day.date, day]));
  const groups = [...svg.matchAll(/<g data-kind="day" ([^>]+)><title>[^<]*<\/title><use href="#([^"]+)"/g)];
  const allDates = [];
  for (let date = new Date(`${year}-01-01T00:00:00Z`); date.getUTCFullYear() === year; date.setUTCDate(date.getUTCDate() + 1)) {
    allDates.push(date.toISOString().slice(0, 10));
  }
  assert.equal(groups.length, allDates.length);
  assert.equal(new Set(groups.map(group => group[1].match(/data-date="([^"]+)"/)[1])).size, allDates.length);
  const symbols = new Map([...svg.matchAll(/<symbol id="([^"]+)"[^>]*><image href="([^"]+)"/g)].map(m => [m[1], m[2]]));
  for (const [index, date] of allDates.entries()) {
    const day = byDate.get(date), future = date > variables.to.slice(0, 10);
    const level = future ? 0 : levels.indexOf(day.contributionLevel);
    const [_, attributes, reference] = groups[index];
    assert(attributes.includes(`data-date="${date}"`), date);
    assert(attributes.includes(`data-count="${future ? 'future' : day.contributionCount}"`), date);
    assert(attributes.includes(`data-level="${future ? 'future' : level}"`), date);
    assert(attributes.includes(`opacity="${future ? '0.3' : '1'}"`), date);
    assert.equal(reference, `leaf-watercolor-${index % 8}-${level}`, date + ' paint level');
    assert.equal(symbols.get(reference), sprites.tiles[`${index % 8}-${level}`].uri, date + ' actual painted PNG');
  }
  const total = records.reduce((sum, day) => sum + day.contributionCount, 0);
  assert(svg.includes(total.toLocaleString('en-US') + '</tspan> contributions.'));
  assert(!svg.includes('<script'));
  assert(!svg.includes('fake-test-token'));
}

test('first request creates a real SVG and stores user metadata; past dates and future outlines match', async t => {
  const h = await harness(t);
  const response = await h.get('/garden/OtTuCk.svg');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/svg+xml; charset=utf-8');
  const svg = await response.text();
  assert.equal(h.state.calls.length, 1);
  checkLeaves(svg, h.state.calls[0], 'regression');
  const row = await h.db.prepare('SELECT * FROM gardens').first();
  assert.equal(row.login, 'ottuck');
  assert.equal(row.requested_year, 0);
  assert(row.updated_at > 0);
  assert(row.next_refresh_at > row.updated_at);
  assert.equal(new Date(row.next_refresh_at).toISOString().slice(11, 16), '00:20');
  assert.equal(row.lock_until, 0);
  assert.equal(await (await h.bucket.get('ottuck/current.svg')).text(), svg);
});

for (const mode of ['regression', 'year-end', 'dense']) {
  test(`2024 leap-year ${mode}: all 366 leaves, high-count year-end days and empty dates are correct`, async t => {
    const h = await harness(t, { mode });
    const response = await h.get('/garden/ottuck.svg?year=2024');
    assert.equal(response.status, 200);
    checkLeaves(await response.text(), h.state.calls[0], mode);
  });
}

test('stored SVG, HEAD and conditional requests reuse the image without another GitHub request', async t => {
  const h = await harness(t);
  const first = await h.get('/garden/ottuck.svg?year=2024'), etag = first.headers.get('ETag');
  const svg = await first.text();
  h.state.status = 503;
  assert.equal(await (await h.get('/garden/ottuck.svg?year=2024')).text(), svg);
  const head = await h.get('/garden/ottuck.svg?year=2024', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('ETag'), etag);
  assert.equal(Number(head.headers.get('Content-Length')), Buffer.byteLength(svg));
  const unchanged = await h.get('/garden/ottuck.svg?year=2024', { headers: { 'If-None-Match': `W/${etag}` } });
  assert.equal(unchanged.status, 304);
  assert.equal(await unchanged.text(), '');
  assert.equal(h.state.calls.length, 1);
});

test('extensionless URLs create and share the legacy image, registration, HEAD and ETag cache', async t => {
  const h = await harness(t);
  for (const query of ['', '?year=2024']) {
    const short = await h.get('/OtTuCk' + query);
    assert.equal(short.status, 200);
    assert.equal(short.headers.get('Content-Type'), 'image/svg+xml; charset=utf-8');
    const svg = await short.text(), etag = short.headers.get('ETag');
    const legacy = await h.get('/garden/ottuck.svg' + query);
    assert.equal(legacy.status, 200);
    assert.equal(await legacy.text(), svg);
    assert.equal(legacy.headers.get('ETag'), etag);
    assert.equal(await (await h.get('/ottuck/' + query)).text(), svg);
    const head = await h.get('/ottuck' + query, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal(head.headers.get('ETag'), etag);
    const unchanged = await h.get('/ottuck' + query, { headers: { 'If-None-Match': etag } });
    assert.equal(unchanged.status, 304);
    await unchanged.text();
  }
  assert.equal(h.state.calls.length, 2, 'one generation per distinct year, shared across URL formats');
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS count FROM gardens').first()).count, 2);
});

test('scheduled update changes old leaves and total while retaining the same URL; no duplicate daily update', async t => {
  const h = await harness(t);
  const before = await (await h.get('/garden/ottuck.svg?year=2024')).text();
  const now = Date.now() + 2 * DAY;
  h.state.mode = 'changed';
  assert.equal((await h.cron(now)).outcome, 'ok');
  const response = await h.get('/garden/ottuck.svg?year=2024'), after = await response.text();
  assert.notEqual(after, before);
  assert.equal(response.headers.get('X-Garden-Updated-At'), new Date(now).toISOString());
  checkLeaves(after, h.state.calls[1], 'changed');
  await h.cron(now + 10 * 60_000);
  assert.equal(h.state.calls.length, 2, 'only one scheduled regeneration per day');
});

test('GitHub outage keeps the old image and successful timestamp, with retry backoff', async t => {
  const h = await harness(t);
  const response = await h.get('/garden/ottuck.svg?year=2024');
  const before = await response.text(), oldTime = response.headers.get('X-Garden-Updated-At');
  h.state.status = 429;
  const now = Date.now() + 2 * DAY;
  await h.cron(now);
  const failed = await h.db.prepare('SELECT * FROM gardens').first();
  assert.equal(failed.last_error, 'github_rate_limited');
  assert.equal(failed.failure_count, 1);
  assert.equal(failed.lock_until, 0);
  assert(failed.next_refresh_at > now);
  const stored = await h.get('/garden/ottuck.svg?year=2024');
  assert.equal(await stored.text(), before);
  assert.equal(stored.headers.get('X-Garden-Updated-At'), oldTime);
  await h.cron(now + 10 * 60_000);
  assert.equal(h.state.calls.length, 2);
  h.state.status = 200;
  await h.cron(failed.next_refresh_at);
  const recovered = await h.db.prepare('SELECT * FROM gardens').first();
  assert.equal(recovered.last_error, null);
  assert.equal(recovered.failure_count, 0);
  assert.equal(recovered.updated_at, failed.next_refresh_at);
});

test('incomplete upstream data cannot replace a previously correct painting', async t => {
  const h = await harness(t);
  const before = await (await h.get('/garden/ottuck.svg?year=2024')).text();
  h.state.mode = 'incomplete';
  await h.cron(Date.now() + 2 * DAY);
  assert.equal(await (await h.get('/garden/ottuck.svg?year=2024')).text(), before);
  assert.equal((await h.db.prepare('SELECT last_error FROM gardens').first()).last_error, 'github_invalid_data');
});

test('overlapping first requests and scheduled runs do not duplicate GitHub calls', async t => {
  const h = await harness(t);
  h.state.delay = true;
  const responses = await Promise.all([h.get('/garden/ottuck.svg'), h.get('/garden/ottuck.svg')]);
  assert(responses.some(response => response.status === 200));
  assert(responses.every(response => [200, 503].includes(response.status)));
  for (const response of responses) await response.text();
  assert.equal(h.state.calls.length, 1);
  const now = Date.now() + 2 * DAY;
  await Promise.all([h.cron(now), h.cron(now)]);
  assert.equal(h.state.calls.length, 2);
});

test('cron processes at most four due users and the next invocation drains the remaining batch', async t => {
  const h = await harness(t);
  const now = Date.now() + 2 * DAY;
  for (let i = 0; i < 8; i++) await h.db.prepare(`INSERT INTO gardens
    (garden_key, login, requested_year, created_at, next_refresh_at) VALUES (?, ?, 2024, ?, ?)`)
    .bind(`user${i}/2024.svg`, `user${i}`, now - DAY, now - DAY).run();
  await h.cron(now);
  assert.equal(h.state.calls.length, 4);
  await h.cron(now);
  assert.equal(h.state.calls.length, 8);
  assert.equal(new Set(h.state.calls.map(call => call.login)).size, 8);
});

test('current-year URL rolls over in January; an explicitly selected year remains fixed', async t => {
  const h = await harness(t);
  await (await h.get('/garden/ottuck.svg')).text();
  await (await h.get('/garden/ottuck.svg?year=2024')).text();
  const nextYear = new Date().getUTCFullYear() + 1;
  const now = Date.parse(`${nextYear}-01-02T00:20:00Z`);
  await h.cron(now);
  const current = await h.get('/garden/ottuck.svg');
  assert.equal(current.headers.get('X-Garden-Year'), String(nextYear));
  checkLeaves(await current.text(), h.state.calls.find(call => call.from.startsWith(String(nextYear))), 'regression');
  const fixed = await h.get('/garden/ottuck.svg?year=2024');
  assert.equal(fixed.headers.get('X-Garden-Year'), '2024');
  await fixed.text();
});

test('nonexistent users get a noncached 404 and repeated requests respect negative-cache backoff', async t => {
  const h = await harness(t, { mode: 'not-found' });
  for (let i = 0; i < 2; i++) {
    const response = await h.get('/garden/missing-user.svg');
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    await response.text();
  }
  assert.equal(h.state.calls.length, 1);
  assert.equal(await h.bucket.get('missing-user/current.svg'), null);
});

test('invalid users, invalid/future years, unknown options and write methods are rejected before API access', async t => {
  const h = await harness(t);
  for (const path of ['/garden/-bad.svg', '/garden/bad--user.svg', '/garden/%3Cscript%3E.svg',
    '/garden/ottuck.svg?year=2100', '/garden/ottuck.svg?year=abc', '/garden/ottuck.svg?year=0000', '/garden/ottuck.svg?year=2007',
    '/garden/ottuck.svg?year=2024&year=2025', '/garden/ottuck.svg?token=unsafe',
    '/-bad', '/bad--user', '/%3Cscript%3E', '/ottuck?year=0000', '/ottuck?year=2100',
    '/ottuck?year=2024&year=2025', '/ottuck?token=unsafe']) {
    const response = await h.get(path);
    assert.equal(response.status, 400, path);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    await response.text();
  }
  assert.equal((await h.get('/garden/ottuck.svg', { method: 'POST' })).status, 405);
  assert.equal((await h.get('/unknown/path')).status, 404);
  assert.equal(h.state.calls.length, 0);
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS count FROM gardens').first()).count, 0);
});

test('missing GitHub secret returns 503 without registering a user or inventing contribution data', async t => {
  const h = await harness(t, { token: '' });
  const health = await h.get('/health');
  assert.equal(health.status, 200);
  const response = await h.get('/garden/ottuck.svg');
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('X-Garden-Error'), 'github_token_missing');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert(!((await response.text()).includes('data-kind="day"')));
  assert.equal(h.state.calls.length, 0);
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS count FROM gardens').first()).count, 0);
});

test('GitHub redirects are not followed and cannot send authorization to another host', async t => {
  const h = await harness(t);
  h.state.status = 302;
  const response = await h.get('/garden/ottuck.svg');
  assert.equal(response.status, 503);
  await response.text();
  assert.equal(h.state.calls.length, 1);
  assert.equal(await h.bucket.get('ottuck/current.svg'), null);
});

test('a missing R2 object can be regenerated without waiting for the next daily refresh', async t => {
  const h = await harness(t);
  const original = await (await h.get('/garden/ottuck.svg?year=2024')).text();
  await h.bucket.delete('ottuck/2024.svg');
  const response = await h.get('/garden/ottuck.svg?year=2024');
  assert.equal(response.status, 200);
  assert.equal(await response.text(), original);
  assert.equal(h.state.calls.length, 2);
});

test('breeze and still share one GitHub snapshot, registration and refresh; standalone leaves are permitted', async t => {
  const h = await harness(t);
  const motion = await h.get('/ottuck?year=2024&motion=breeze');
  const breeze = await motion.text();
  assert.equal(motion.status, 200);
  assert.equal(motion.headers.get('X-Garden-Motion'), 'breeze');
  assert.match(motion.headers.get('Content-Security-Policy'), /img-src data:/);
  assert.match(breeze, /@keyframes leaf-breeze/);
  checkLeaves(breeze, h.state.calls[0], 'regression');
  const still = await h.get('/ottuck?year=2024');
  const staticSvg = await still.text();
  assert(!staticSvg.includes('@keyframes'));
  assert.equal(still.headers.get('X-Garden-Motion'), 'none');
  assert.equal(still.headers.get('X-Garden-Updated-At'), motion.headers.get('X-Garden-Updated-At'));
  const dayGroups = svg => [...svg.matchAll(/<g data-kind="day"[^>]*>.*?<\/g>/g)].map(m => m[0]);
  assert.deepEqual(dayGroups(breeze), dayGroups(staticSvg));
  assert.equal(h.state.calls.length, 1);
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS count FROM gardens').first()).count, 1);
  const legacy = await h.get('/garden/ottuck.svg?year=2024&motion=breeze');
  assert.equal(await legacy.text(), breeze);
  const head = await h.get('/ottuck?year=2024&motion=breeze', { method: 'HEAD' });
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('ETag'), motion.headers.get('ETag'));
  const conditional = await h.get('/ottuck?year=2024&motion=breeze', {
    headers: { 'If-None-Match': motion.headers.get('ETag') }
  });
  assert.equal(conditional.status, 304);
  await conditional.text();
  h.state.mode = 'changed';
  await h.cron(Date.now() + 2 * DAY);
  const refreshed = await (await h.get('/ottuck?year=2024&motion=breeze')).text();
  checkLeaves(refreshed, h.state.calls[1], 'changed');
  assert.deepEqual(dayGroups(refreshed), dayGroups(await (await h.get('/ottuck?year=2024')).text()));
  assert.equal(h.state.calls.length, 2);
});

test('an existing static garden gains a missing breeze image without duplicate registration', async t => {
  const h = await harness(t);
  await (await h.get('/ottuck?year=2024')).text();
  await h.bucket.delete(`ottuck/2024.breeze-v${BREEZE_REVISION}.svg`);
  const response = await h.get('/ottuck?year=2024&motion=breeze');
  assert.equal(response.status, 200);
  checkLeaves(await response.text(), h.state.calls[1], 'regression');
  assert.equal(h.state.calls.length, 2);
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS count FROM gardens').first()).count, 1);
});

test('hosted comparison has working same-origin images and direct SVG links without GitHub raw', async t => {
  const h = await harness(t);
  const response = await h.get('/preview/OtTuCk?year=2024');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /^text\/html/);
  const html = await response.text();
  assert(html.includes('src="/ottuck?year=2024"'));
  assert(html.includes('src="/ottuck?year=2024&amp;motion=breeze"'));
  assert(html.includes('href="/ottuck?year=2024&amp;motion=breeze"'));
  assert(html.includes('<source media="(prefers-reduced-motion: reduce)"'));
  assert(!html.includes('raw.githubusercontent.com'));
  assert(!html.includes('<script'));
  assert.equal(h.state.calls.length, 0);
  assert.equal(await (await h.get('/preview/ottuck', { method: 'HEAD' })).text(), '');
  for (const path of ['/ottuck?motion=fast', '/ottuck?motion=', '/ottuck?motion=breeze&motion=none',
    '/preview/%3Cscript%3E', '/preview/ottuck?year=2100']) {
    const invalid = await h.get(path);
    assert.equal(invalid.status, 400, path);
    await invalid.text();
  }
  assert.equal(h.state.calls.length, 0);
});
