import { calendarSvg } from '../../scripts/calendar.mjs';
import sprites from '../../artwork/calendar/watercolor-sprites.json';
import { fetchGitHubCalendar, GardenError } from './github';

export interface Env {
  DB: D1Database;
  GARDENS: R2Bucket;
  GITHUB_TOKEN: string;
  REFRESH_BATCH_SIZE?: string;
}

interface Garden {
  garden_key: string;
  login: string;
  requested_year: number;
  updated_at: number | null;
  next_refresh_at: number;
  lock_until: number;
  failure_count: number;
}

const HOUR = 3_600_000;
const LEASE = 120_000;
const CACHE = 'public, max-age=3600, s-maxage=3600';

function nextRefresh(now: number) {
  const next = new Date(now);
  next.setUTCHours(0, 20, 0, 0);
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime();
}

function parseGarden(url: URL, now: number) {
  const match = /^\/garden\/([^/]+)\.svg$/.exec(url.pathname);
  if (!match) return null;
  let login;
  try { login = decodeURIComponent(match[1]).toLowerCase(); }
  catch { throw new GardenError('invalid_login', 400); }
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/.test(login)) {
    throw new GardenError('invalid_login', 400);
  }
  for (const key of url.searchParams.keys()) {
    if (key !== 'year') throw new GardenError('unknown_option', 400);
  }
  if (url.searchParams.getAll('year').length > 1) throw new GardenError('invalid_year', 400);
  const value = url.searchParams.get('year');
  const requested_year = value === null ? 0 : /^\d{4}$/.test(value) ? Number(value) : -1;
  const currentYear = new Date(now).getUTCFullYear();
  if (value !== null && (requested_year < 2008 || requested_year > currentYear)) {
    throw new GardenError('invalid_year', 400);
  }
  return { login, requested_year,
    garden_key: `${login}/${requested_year || 'current'}.svg` };
}

function errorResponse(error: unknown, head = false) {
  const known = error instanceof GardenError ? error : new GardenError('garden_unavailable');
  const message = known.status === 404 ? 'GitHub user not found'
    : known.status === 400 ? 'Check the garden URL'
    : 'Garden temporarily unavailable. Please try again later.';
  // Error messages never include upstream payloads, credentials, or user-supplied markup.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160" viewBox="0 0 640 160"><rect width="640" height="160" fill="#f6f0e2"/><text x="320" y="70" text-anchor="middle" font-family="Georgia,serif" font-size="24" fill="#685b43">Botanical garden</text><text x="320" y="105" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#685b43">${message}</text></svg>`;
  return new Response(head ? null : svg, { status: known.status, headers: {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Garden-Error': known.code,
    ...(known.status === 503 ? { 'Retry-After': '60' } : {})
  } });
}

function imageResponse(object: R2Object | R2ObjectBody, request: Request) {
  const headers = new Headers({
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': CACHE,
    'ETag': object.httpEtag,
    'X-Content-Type-Options': 'nosniff',
    'X-Garden-Updated-At': object.customMetadata?.updatedAt || object.uploaded.toISOString(),
    'X-Garden-As-Of': object.customMetadata?.asOf || '',
    'X-Garden-Year': object.customMetadata?.year || ''
  });
  const condition = request.headers.get('If-None-Match');
  if (condition?.split(',').some(tag => tag.trim() === '*' || tag.trim().replace(/^W\//, '') === object.httpEtag)) {
    if ('body' in object) void object.body.cancel();
    return new Response(null, { status: 304, headers });
  }
  headers.set('Content-Length', String(object.size));
  return new Response(request.method === 'HEAD' || !('body' in object) ? null : object.body, { headers });
}

async function refreshGarden(env: Env, garden: Pick<Garden, 'garden_key' | 'login' | 'requested_year'>, now: number, missingImage = false) {
  if (!env.GITHUB_TOKEN) throw new GardenError('github_token_missing');
  const leaseToken = crypto.randomUUID();
  const leased = await env.DB.prepare(`UPDATE gardens SET lock_until = ?, lock_token = ?
    WHERE garden_key = ? AND lock_until <= ? AND (next_refresh_at <= ? OR ? = 1)
    RETURNING garden_key, login, requested_year, updated_at, failure_count`)
    .bind(now + LEASE, leaseToken, garden.garden_key, now, now, missingImage ? 1 : 0).first<Garden>();
  if (!leased) return false;
  try {
    const year = garden.requested_year || new Date(now).getUTCFullYear();
    const data = await fetchGitHubCalendar(garden.login, year, env.GITHUB_TOKEN, now);
    const svg = calendarSvg(data, { theme: 'watercolor', sprites });
    await env.GARDENS.put(garden.garden_key, svg, {
      httpMetadata: { contentType: 'image/svg+xml; charset=utf-8', cacheControl: CACHE },
      customMetadata: {
        updatedAt: new Date(now).toISOString(), asOf: data.asOf, year: String(year),
        contributions: String(data.days.reduce((sum, day) => sum + (day.count || 0), 0))
      }
    });
    await env.DB.prepare(`UPDATE gardens SET updated_at = ?, next_refresh_at = ?,
      lock_until = 0, lock_token = NULL, failure_count = 0, last_error = NULL
      WHERE garden_key = ? AND lock_token = ?`)
      .bind(now, nextRefresh(now), garden.garden_key, leaseToken).run();
    return true;
  } catch (error) {
    const known = error instanceof GardenError ? error : new GardenError('garden_unavailable');
    // Keep successful artwork during outages; defer retry instead of replacing it with an empty plant.
    const delay = known.status === 404 ? 24 * HOUR
      : Math.min(24, 2 ** Math.min(leased.failure_count, 5)) * HOUR;
    await env.DB.prepare(`UPDATE gardens SET next_refresh_at = ?, lock_until = 0,
      lock_token = NULL, failure_count = failure_count + 1, last_error = ?
      WHERE garden_key = ? AND lock_token = ?`)
      .bind(now + delay, known.code, garden.garden_key, leaseToken).run();
    throw known;
  }
}

async function serveGarden(request: Request, env: Env, now: number) {
  const url = new URL(request.url);
  const garden = parseGarden(url, now);
  if (!garden) return new Response('Not found', { status: 404 });
  let image = request.method === 'HEAD'
    ? await env.GARDENS.head(garden.garden_key) : await env.GARDENS.get(garden.garden_key);
  if (image) return imageResponse(image, request);
  if (!env.GITHUB_TOKEN) throw new GardenError('github_token_missing');
  await env.DB.prepare(`INSERT INTO gardens
    (garden_key, login, requested_year, created_at, next_refresh_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(garden_key) DO NOTHING`)
    .bind(garden.garden_key, garden.login, garden.requested_year, now, now).run();
  const state = await env.DB.prepare(`SELECT updated_at, next_refresh_at, last_error
    FROM gardens WHERE garden_key = ?`).bind(garden.garden_key)
    .first<{ updated_at: number | null; next_refresh_at: number; last_error: string | null }>();
  if (state && state.next_refresh_at > now && state.last_error) {
    throw new GardenError(state.last_error, state.last_error === 'github_user_not_found' ? 404 : 503);
  }
  await refreshGarden(env, garden, now, true);
  image = request.method === 'HEAD'
    ? await env.GARDENS.head(garden.garden_key) : await env.GARDENS.get(garden.garden_key);
  if (!image) throw new GardenError('garden_generating');
  return imageResponse(image, request);
}

async function refreshDue(env: Env, now: number) {
  if (!env.GITHUB_TOKEN) throw new GardenError('github_token_missing');
  // Bound each invocation so a growing user list never becomes one unbounded cron job.
  const limit = Math.max(1, Math.min(4, Math.floor(Number(env.REFRESH_BATCH_SIZE) || 4)));
  const due = await env.DB.prepare(`SELECT garden_key, login, requested_year
    FROM gardens WHERE next_refresh_at <= ? AND lock_until <= ?
    ORDER BY next_refresh_at, garden_key LIMIT ?`).bind(now, now, limit).all<Garden>();
  let updated = 0, failed = 0;
  for (const garden of due.results) {
    try { if (await refreshGarden(env, garden, now)) updated++; }
    catch (error) {
      failed++;
      console.error(JSON.stringify({ event: 'garden_refresh_failed', key: garden.garden_key,
        code: error instanceof GardenError ? error.code : 'garden_unavailable' }));
    }
  }
  console.log(JSON.stringify({ event: 'garden_refresh_batch', checked: due.results.length, updated, failed }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    if (url.pathname === '/health') {
      return Response.json({ service: 'botanical-garden', status: 'ok', theme: 'watercolor' }, {
        headers: { 'Cache-Control': 'no-store' }
      });
    }
    try { return await serveGarden(request, env, Date.now()); }
    catch (error) {
      console.error(JSON.stringify({ event: 'garden_request_failed',
        code: error instanceof GardenError ? error.code : 'garden_unavailable' }));
      return errorResponse(error, request.method === 'HEAD');
    }
  },
  async scheduled(event, env) {
    await refreshDue(env, event.scheduledTime);
  }
} satisfies ExportedHandler<Env>;
