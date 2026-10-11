import { normalizeCalendar } from '../../scripts/calendar.mjs';

export class GardenError extends Error {
  constructor(public readonly code: string, public readonly status = 503) {
    super(code);
  }
}

const query = `query($login:String!,$from:DateTime!,$to:DateTime!) {
  user(login:$login) {
    login
    contributionsCollection(from:$from,to:$to) {
      contributionCalendar { weeks { contributionDays {
        date contributionCount contributionLevel
      } } }
    }
  }
}`;

export async function fetchGitHubCalendar(login: string, year: number, token: string, now: number) {
  const asOf = new Date(now).toISOString().slice(0, 10);
  const end = asOf < `${year}-12-31` ? asOf : `${year}-12-31`;
  let payload;
  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'botanical-garden-worker'
      },
      body: JSON.stringify({ query, variables: {
        login, from: `${year}-01-01T00:00:00Z`, to: `${end}T23:59:59Z`
      } }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new GardenError(response.status === 403 || response.status === 429
        ? 'github_rate_limited' : 'github_unavailable');
    }
    payload = await response.json() as {
      errors?: { type?: string }[];
      data?: { user?: null | {
        login: string;
        contributionsCollection?: { contributionCalendar?: {
          weeks: { contributionDays: {
            date: string; contributionCount: number; contributionLevel: string;
          }[] }[];
        } };
      } };
    };
  } catch (error) {
    if (error instanceof GardenError) throw error;
    throw new GardenError('github_unavailable');
  }
  if (payload.errors?.length) {
    if (payload.errors.every(error => error.type === 'NOT_FOUND')) {
      throw new GardenError('github_user_not_found', 404);
    }
    throw new GardenError('github_query_failed');
  }
  if (payload.data?.user === null) throw new GardenError('github_user_not_found', 404);
  const user = payload.data?.user;
  const calendar = user?.contributionsCollection?.contributionCalendar;
  if (!calendar) throw new GardenError('github_invalid_data');
  try {
    return normalizeCalendar(calendar.weeks.flatMap(week => week.contributionDays), {
      year, asOf: end, login: user.login, source: 'github'
    });
  } catch {
    throw new GardenError('github_invalid_data');
  }
}
