import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Never write a token into a tracked file, a URL, or a command-line argument.
let token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token && process.argv.includes('--from-gh')) {
  const result = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('GitHub CLI authentication is required.');
  token = result.stdout.trim();
}
if (!token) throw new Error('Set GITHUB_TOKEN or explicitly pass --from-gh to use the current GitHub CLI login.');
const result = spawnSync(process.execPath, [path.resolve(import.meta.dirname, '../node_modules/wrangler/bin/wrangler.js'),
  'secret', 'put', 'GITHUB_TOKEN'], { input: token + '\n', encoding: 'utf8', windowsHide: true,
  cwd: path.resolve(import.meta.dirname, '..') });
const redact = text => (text || '').split(token).join('[redacted]');
process.stdout.write(redact(result.stdout));
process.stderr.write(redact(result.stderr));
if (result.status !== 0) process.exit(result.status || 1);
