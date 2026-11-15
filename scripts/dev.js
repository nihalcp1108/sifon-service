import { spawn } from 'child_process';
import process from 'process';

console.log('[Dev] Starting sifon-service Backend and Frontend...');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const backend = spawn(npmCmd, ['--prefix', 'backend', 'run', 'dev'], {
  stdio: 'inherit',
  shell: true,
});

const frontend = spawn(npmCmd, ['--prefix', 'frontend', 'run', 'dev'], {
  stdio: 'inherit',
  shell: true,
});

function cleanup() {
  console.log('\n[Dev] Shutting down development servers...');
  if (isWin) {
    if (backend.pid) spawn('taskkill', ['/pid', String(backend.pid), '/f', '/t']);
    if (frontend.pid) spawn('taskkill', ['/pid', String(frontend.pid), '/f', '/t']);
  } else {
    backend.kill('SIGINT');
    frontend.kill('SIGINT');
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

