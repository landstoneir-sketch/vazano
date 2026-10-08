import { execFileSync } from 'node:child_process';

const E2E_PORTS = new Set(['3100', '3101']);

if (process.platform === 'win32') {
  const output = execFileSync(`${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\netstat.exe`, ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
  const processIds = new Set();

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
    if (match && E2E_PORTS.has(match[1])) processIds.add(match[2]);
  }

  for (const processId of processIds) {
    try {
      execFileSync('taskkill.exe', ['/PID', processId, '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // The process may have exited between discovery and cleanup.
    }
  }
}
