import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { arch, cpus, platform, release, totalmem } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { classifyBackground } from '../src/background-classifier'

type CommandResult = {
  durationMs: number
  stdout: string
  stderr: string
}

type Check = {
  name: string
  actual: number
  operator: '<=' | '>='
  budget: number
  passed: boolean
}

type QueryFixture = {
  name: string
  query: string
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const budgets = await Bun.file(join(root, 'performance/budgets.json')).json()
const queryFixtures = (await Bun.file(
  join(root, 'performance/queries.json')
).json()) as QueryFixture[]
const live = process.argv.includes('--live')
const endpoint = process.env.SUBGRAPH_PERFORMANCE_URL
const token = process.env.SUBGRAPH_PERFORMANCE_TOKEN
const chainRpcUrl = process.env.SUBGRAPH_CHAIN_RPC_URL
const checks: Check[] = []

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function addCheck(name: string, actual: number, operator: Check['operator'], budget: number): void {
  checks.push({
    name,
    actual: round(actual),
    operator,
    budget,
    passed: operator === '<=' ? actual <= budget : actual >= budget,
  })
}

async function runCommand(command: string[]): Promise<CommandResult> {
  const startedAt = performance.now()
  const child = Bun.spawn(command, {
    cwd: root,
    env: process.env,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  const durationMs = performance.now() - startedAt

  if (exitCode !== 0) {
    process.stderr.write(stdout)
    process.stderr.write(stderr)
    throw new Error(`${command.join(' ')} exited with ${exitCode}`)
  }

  return { durationMs, stdout, stderr }
}

async function wasmSnapshot(): Promise<{ bytes: number; sha256: string }> {
  const bytes = await readFile(join(root, 'build/NiftyDegen/NiftyDegen.wasm'))
  return {
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

async function dependencySnapshot(): Promise<{
  installedBytes: number
  lockfileBytes: number
  resolvedEntries: number
}> {
  const [disk, list, lockfile] = await Promise.all([
    runCommand(['du', '-skL', 'node_modules']),
    runCommand(['bun', 'pm', 'ls', '--all']),
    readFile(join(root, 'bun.lock')),
  ])
  const installedKiB = Number.parseInt(disk.stdout.trim().split(/\s+/)[0], 10)
  const resolvedEntries = list.stdout.split('\n').filter((line) => /[├└]──/.test(line)).length

  return {
    installedBytes: installedKiB * 1024,
    lockfileBytes: lockfile.byteLength,
    resolvedEntries,
  }
}

function benchmarkBackgroundClassifier(): {
  operations: number
  durationMs: number
  operationsPerSecond: number
  checksum: number
} {
  const operations = 1_000_000
  for (let index = 0; index < 10_000; index++) classifyBackground(index % 10_001)

  let checksum = 0
  const startedAt = performance.now()
  for (let index = 0; index < operations; index++) {
    checksum += classifyBackground(index % 10_001).length
  }
  const durationMs = performance.now() - startedAt

  return {
    operations,
    durationMs: round(durationMs),
    operationsPerSecond: round(operations / (durationMs / 1000)),
    checksum,
  }
}

function percentile(values: number[], fraction: number): number {
  const sorted = values.toSorted((left, right) => left - right)
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]
}

async function requestGraph(query: string): Promise<{
  durationMs: number
  data: Record<string, unknown>
}> {
  if (!endpoint) throw new Error('SUBGRAPH_PERFORMANCE_URL is required with --live')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`

  const startedAt = performance.now()
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  })
  const durationMs = performance.now() - startedAt
  const payload = (await response.json()) as {
    data?: Record<string, unknown>
    errors?: Array<{ message?: string }>
  }

  if (!response.ok || payload.errors || !payload.data) {
    const messages = payload.errors?.map((error) => error.message).join('; ')
    throw new Error(`Graph query failed (${response.status}): ${messages ?? 'missing data'}`)
  }

  return { durationMs, data: payload.data }
}

async function requestChainHead(): Promise<number> {
  if (!chainRpcUrl) throw new Error('SUBGRAPH_CHAIN_RPC_URL is required with --live')
  const response = await fetch(chainRpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
  })
  const payload = (await response.json()) as { result?: string; error?: { message?: string } }
  if (!response.ok || payload.error || !payload.result) {
    throw new Error(
      `Chain head query failed (${response.status}): ${payload.error?.message ?? 'missing result'}`
    )
  }

  return Number.parseInt(payload.result, 16)
}

async function liveSnapshot(): Promise<Record<string, unknown>> {
  const metadataQuery = queryFixtures.find((fixture) => fixture.name === 'metadata')?.query
  if (!metadataQuery) throw new Error('metadata query fixture is required')

  const [initial, initialChainHead] = await Promise.all([
    requestGraph(metadataQuery),
    requestChainHead(),
  ])
  const queryResults: Array<Record<string, unknown>> = []

  for (const fixture of queryFixtures) {
    await requestGraph(fixture.query)
    const samples: number[] = []
    for (let sample = 0; sample < budgets.live.sampleCount; sample++) {
      samples.push((await requestGraph(fixture.query)).durationMs)
    }
    const p95Ms = percentile(samples, 0.95)
    const maxMs = Math.max(...samples)
    addCheck(`live.${fixture.name}.p95Ms`, p95Ms, '<=', budgets.live.queryP95Ms)
    addCheck(`live.${fixture.name}.maxMs`, maxMs, '<=', budgets.live.queryMaxMs)
    queryResults.push({
      name: fixture.name,
      samplesMs: samples.map((sample) => round(sample)),
      p50Ms: round(percentile(samples, 0.5)),
      p95Ms: round(p95Ms),
      maxMs: round(maxMs),
    })
  }

  await Bun.sleep(budgets.live.indexingSampleMs)
  const [final, finalChainHead] = await Promise.all([
    requestGraph(metadataQuery),
    requestChainHead(),
  ])
  const initialMeta = initial.data['_meta'] as {
    block: { number: number }
    hasIndexingErrors: boolean
  }
  const finalMeta = final.data['_meta'] as {
    block: { number: number }
    hasIndexingErrors: boolean
  }
  const elapsedSeconds = budgets.live.indexingSampleMs / 1000
  const finalBlockLag = finalChainHead - finalMeta.block.number
  addCheck('live.indexing.blockLag', finalBlockLag, '<=', budgets.live.maxBlockLag)
  addCheck(
    'live.indexing.hasIndexingErrors',
    initialMeta.hasIndexingErrors || finalMeta.hasIndexingErrors ? 1 : 0,
    '<=',
    0
  )

  return {
    configured: true,
    authentication: token ? 'bearer token' : 'none',
    queries: queryResults,
    indexing: {
      initialBlock: initialMeta.block.number,
      finalBlock: finalMeta.block.number,
      initialChainHead,
      finalChainHead,
      finalBlockLag,
      sampledSeconds: elapsedSeconds,
      indexedBlocksPerSecond: round(
        (finalMeta.block.number - initialMeta.block.number) / elapsedSeconds
      ),
      hasIndexingErrors: initialMeta.hasIndexingErrors || finalMeta.hasIndexingErrors,
    },
  }
}

const codegen = await runCommand(['bun', 'run', 'codegen'])
const mainnetBuild = await runCommand(['bun', 'run', 'build:mainnet'])
const mainnetWasm = await wasmSnapshot()
const sepoliaBuild = await runCommand(['bun', 'run', 'build:sepolia'])
const sepoliaWasm = await wasmSnapshot()
const matchstick = await runCommand(['bun', 'run', 'test:integration'])
const ansiEscapePattern = new RegExp(`${String.fromCodePoint(27)}\\[[0-?]*[ -/]*[@-~]`, 'g')
const plainMatchstick = `${matchstick.stdout}\n${matchstick.stderr}`.replace(ansiEscapePattern, '')
const fixtureMatch = plainMatchstick.match(
  /indexes 1000 representative approval events\s+-\s+([\d.]+)ms/
)
if (!fixtureMatch) throw new Error('Unable to read the Matchstick performance fixture duration')
const fixtureDurationMs = Number(fixtureMatch[1])
const fixtureEventsPerSecond = budgets.fixtureEventCount / (fixtureDurationMs / 1000)
const backgroundClassifier = benchmarkBackgroundClassifier()
const dependencies = await dependencySnapshot()
const nodeVersion = (await runCommand(['node', '--version'])).stdout.trim()

addCheck('local.codegenMs', codegen.durationMs, '<=', budgets.local.codegenMs)
addCheck('local.mainnetBuildMs', mainnetBuild.durationMs, '<=', budgets.local.buildMsPerNetwork)
addCheck('local.sepoliaBuildMs', sepoliaBuild.durationMs, '<=', budgets.local.buildMsPerNetwork)
addCheck('local.matchstickSuiteMs', matchstick.durationMs, '<=', budgets.local.matchstickSuiteMs)
addCheck(
  'local.approvalFixtureEventsPerSecond',
  fixtureEventsPerSecond,
  '>=',
  budgets.local.approvalFixtureMinEventsPerSecond
)
addCheck(
  'local.backgroundClassifierOperationsPerSecond',
  backgroundClassifier.operationsPerSecond,
  '>=',
  budgets.local.backgroundClassifierMinOperationsPerSecond
)
addCheck('local.mainnetWasmBytes', mainnetWasm.bytes, '<=', budgets.local.wasmBytesPerNetwork)
addCheck('local.sepoliaWasmBytes', sepoliaWasm.bytes, '<=', budgets.local.wasmBytesPerNetwork)
addCheck(
  'local.installedDependencyBytes',
  dependencies.installedBytes,
  '<=',
  budgets.local.installedDependencyBytes
)
addCheck(
  'local.resolvedDependencyEntries',
  dependencies.resolvedEntries,
  '<=',
  budgets.local.resolvedDependencyEntries
)

const liveResults = live ? await liveSnapshot() : { configured: false, status: 'skipped' }
const result = {
  schemaVersion: budgets.schemaVersion,
  capturedAt: new Date().toISOString(),
  environment: {
    platform: `${platform()} ${release()}`,
    architecture: arch(),
    cpu: cpus()[0]?.model ?? 'unknown',
    logicalCpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
    bun: Bun.version,
    node: nodeVersion,
  },
  local: {
    codegenMs: round(codegen.durationMs),
    builds: {
      mainnet: { durationMs: round(mainnetBuild.durationMs), wasm: mainnetWasm },
      sepolia: { durationMs: round(sepoliaBuild.durationMs), wasm: sepoliaWasm },
      identicalWasm: mainnetWasm.sha256 === sepoliaWasm.sha256,
    },
    mappingRuntime: { backgroundClassifier },
    indexingFixture: {
      event: 'Approval',
      events: budgets.fixtureEventCount,
      durationMs: fixtureDurationMs,
      eventsPerSecond: round(fixtureEventsPerSecond),
      matchstickSuiteMs: round(matchstick.durationMs),
    },
    dependencies,
  },
  live: liveResults,
  checks,
  passed: checks.every((check) => check.passed),
}

console.log(JSON.stringify(result, null, 2))
if (!result.passed) process.exitCode = 1
