import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Preserve the existing development saves; fresh clones keep data in the repo.
const legacyRoot = path.dirname(repository);
// ATTAINDER_DATA_HOME replaces TIDES_DATA_HOME; the old name still works.
const dataHome = process.env.ATTAINDER_DATA_HOME || process.env.TIDES_DATA_HOME;
const root = dataHome ? path.resolve(dataHome)
  : existsSync(path.join(legacyRoot, 'SPELA.md')) && existsSync(path.join(legacyRoot, 'play-data')) ? legacyRoot : repository;
const origin = 'http://127.0.0.1:4167';
const reports = path.join(root, 'reports', 'launcher');
mkdirSync(reports, { recursive: true });

async function identify() {
  try {
    const response = await fetch(`${origin}/api/local-models/info`, { signal: AbortSignal.timeout(2000) });
    const info = await response.json();
    return info.app === 'open-historia-dynasties';
  } catch { return false; }
}

if (!existsSync(path.join(repository, 'dist', 'index.html'))) {
  throw new Error('Game build missing. Run npm ci and npm run build in the repository first.');
}

if (!(await identify())) {
  // Leave unrelated listeners alone. A successful connection with the wrong
  // identity is an error, not permission to kill or replace that process.
  try {
    await fetch(origin, { signal: AbortSignal.timeout(2000) });
    throw new Error('Port 4167 används redan av ett annat program. Stäng det programmet eller kontakta utvecklaren.');
  } catch (error) {
    if (error.message.startsWith('Port 4167')) throw error;
  }
  const output = openSync(path.join(reports, 'server.log'), 'a');
  const diagnostic = openSync(path.join(reports, 'server-error.log'), 'a');
  const child = spawn(process.execPath, ['server/server.js'], {
    cwd: repository,
    env: { ...process.env, PORT: '4167', OH_HOST: '127.0.0.1', OH_DATA_DIR: path.join(root, 'play-data') },
    detached: true, windowsHide: true, stdio: ['ignore', output, diagnostic],
  });
  child.on('error', error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
  child.unref();
  closeSync(output); closeSync(diagnostic);
  writeFileSync(path.join(reports, 'server-process.json'), JSON.stringify({ pid: child.pid, repository, origin, startedAt: new Date().toISOString() }, null, 2));
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await identify()) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Spelet kunde inte starta. Se reports/launcher/server-error.log.');
}

console.log(`Attainder is ready at ${origin}`);
if (!process.argv.includes('--no-browser')) {
  if (process.platform === 'win32') {
    spawn('rundll32.exe', ['url.dll,FileProtocolHandler', origin], { detached: true, windowsHide: true, stdio: 'ignore' }).unref();
  } else {
    spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [origin], { detached: true, stdio: 'ignore' }).unref();
  }
}
