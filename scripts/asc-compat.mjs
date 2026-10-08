// Recreate the "bin/asc" launcher that Matchstick's test host spawns.
//
// AssemblyScript 0.27+ stopped shipping the POSIX "bin/asc" wrapper and only
// installs "bin/asc.js". Matchstick 0.6.0 (the only host `graph test` can run)
// executes "<libs>/assemblyscript/bin/asc" directly, so `graph test` fails
// with ENOENT as soon as the repository tracks a modern compiler. This
// postinstall step recreates the thin wrapper until a Matchstick release
// targets the new layout (see issue #55).
import { chmod, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const binDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  'assemblyscript',
  'bin'
)
const launcher = join(binDir, 'asc')
const entry = join(binDir, 'asc.js')

try {
  await stat(entry)
} catch {
  // Not an AssemblyScript layout without "bin/asc.js": nothing to bridge.
  process.exit(0)
}

try {
  await stat(launcher)
  // A launcher is already present (older layout or a previous run).
  process.exit(0)
} catch {
  // fall through and create it
}

const wrapper = [
  '#!/bin/sh',
  '# Compat launcher recreated by scripts/asc-compat.mjs (see issue #55).',
  'basedir=$(dirname "$0")',
  'exec node "$basedir/asc.js" "$@"',
  '',
].join('\n')

await mkdir(binDir, { recursive: true })
await writeFile(launcher, wrapper)
await chmod(launcher, 0o755)
