import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const generatedFiles = [
  path.join(root, 'apps', 'web', 'tsconfig.json'),
];
const snapshots = await Promise.all(generatedFiles.map(async (file) => [file, await readFile(file)]));
const playwrightCli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
const child = spawn(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
});

const relaySignal = (signal) => child.kill(signal);
process.once('SIGINT', relaySignal);
process.once('SIGTERM', relaySignal);

let exitCode = 1;
try {
  exitCode = await new Promise((resolve) => {
    child.once('error', () => resolve(1));
    child.once('exit', (code) => resolve(code ?? 1));
  });
} finally {
  process.removeListener('SIGINT', relaySignal);
  process.removeListener('SIGTERM', relaySignal);
  await Promise.all(snapshots.map(([file, content]) => writeFile(file, content)));
}

process.exitCode = exitCode;
