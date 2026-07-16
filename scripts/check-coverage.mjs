import { spawn } from 'node:child_process';

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(command, ['exec', 'graph', 'test', '--version', '0.6.0', '--coverage'], {
  stdio: ['inherit', 'pipe', 'pipe'],
});

let output = '';

for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    stream === child.stdout ? process.stdout.write(text) : process.stderr.write(text);
  });
}

const exitCode = await new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('close', resolve);
});

if (exitCode !== 0) {
  process.exit(exitCode ?? 1);
}

const plainOutput = output.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
const globalMatches = [...plainOutput.matchAll(/Global test coverage:\s*([\d.]+)%/gi)];
const coverageMatches = [...plainOutput.matchAll(/Test coverage:\s*([\d.]+)%/gi)];
const match = globalMatches.at(-1) ?? coverageMatches.at(-1);

if (!match) {
  console.error('Unable to read Matchstick handler coverage from the test output.');
  process.exit(1);
}

const coverage = Number(match[1]);
const threshold = 100;

if (coverage < threshold) {
  console.error(`Handler coverage ${coverage}% is below the required ${threshold}%.`);
  process.exit(1);
}

console.log(`Handler coverage gate passed: ${coverage}% (minimum ${threshold}%).`);
