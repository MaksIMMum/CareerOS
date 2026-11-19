// Builds the Chrome Web Store package: extension/release/careeros-extension-<version>.zip
// Usage: npm run package:extension (after `npm run deploy` wrote frontend/.env.production).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fail = (msg) => {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
};

const env = join(root, '../frontend/.env.production');
if (!existsSync(env) || !/^VITE_API_URL=https:\/\//m.test(readFileSync(env, 'utf8'))) {
  fail('frontend/.env.production with VITE_API_URL is missing — run `npm run deploy` first.');
}

// Run Vite's CLI with this Node directly: `npx` is a .cmd on Windows and can't be spawned without a shell.
const viteBin = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin', 'vite.js');
execFileSync(process.execPath, [viteBin, 'build'], { cwd: root, stdio: 'inherit', env: { ...process.env, CAREEROS_STORE: '1' } });

const out = join(root, 'dist-store');
const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
if ('key' in manifest) fail('the store manifest must not contain "key"');
if (!manifest.host_permissions.some((h) => h.includes('execute-api'))) fail('the API host is missing from host_permissions');
for (const f of ['_locales/uk/messages.json', '_locales/en/messages.json', 'icons/icon-128.png', 'background.js', 'sidepanel.html']) {
  if (!existsSync(join(out, f))) fail(`${f} is missing from the build`);
}

const release = join(root, 'release');
mkdirSync(release, { recursive: true });
const zip = join(release, `careeros-extension-${manifest.version}.zip`);
rmSync(zip, { force: true });
if (process.platform === 'win32') {
  // Windows has no `zip`; its built-in bsdtar writes a zip with forward-slash paths (-a picks the format from .zip).
  execFileSync('tar', ['-a', '-c', '-f', zip, ...readdirSync(out)], { cwd: out, stdio: 'inherit' });
} else {
  execFileSync('zip', ['-r', '-X', '-q', zip, '.'], { cwd: out, stdio: 'inherit' });
}
console.log(`\n✔ ${zip}\n  Upload it at https://chrome.google.com/webstore/devconsole (see docs/chrome-web-store.md).`);
