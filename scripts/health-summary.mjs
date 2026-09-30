#!/usr/bin/env node
// Render the credential-safe deployment health summary for a live performance
// audit report.
//
// `bun run performance:live` writes a JSON report whose live section records
// only query timings, the indexed block range, the source-chain head, and
// whether the deployment reported indexing errors. The endpoint URL and the
// bearer token are never part of the report, so this script only reads the
// structured fields and is safe to publish in a job summary or an issue.
//
// The verdict is derived from the `live.*` checks only. A slow local build
// budget on the runner must not be reported as a deployment incident.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const LIVE_CHECK_PREFIX = 'live.'

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'unknown'
}

function formatCheck(check) {
  const verdict = check.passed ? 'pass' : 'FAIL'
  return `| \`${check.name}\` | ${formatNumber(check.actual)} | ${check.operator} ${formatNumber(
    check.budget
  )} | ${verdict} |`
}

/**
 * Build the Markdown summary and the health verdict for a report.
 *
 * @param {Record<string, any> | null | undefined} report parsed audit report
 * @returns {{status: 'healthy' | 'degraded' | 'unconfigured' | 'unreadable', failed: string[], markdown: string}}
 */
export function summarize(report) {
  const live = report?.live
  if (!report || typeof report !== 'object' || !Array.isArray(report.checks)) {
    return {
      status: 'unreadable',
      failed: [],
      markdown: [
        '## Subgraph deployment health: unknown',
        '',
        'The live probe did not return a usable report, so indexing errors and block lag',
        'could not be read. The endpoint is never echoed into this summary; reproduce the',
        'probe locally with `bun run performance:live` and the documented environment.',
        '',
      ].join('\n'),
    }
  }

  const checks = report.checks.filter(
    (check) => typeof check?.name === 'string' && check.name.startsWith(LIVE_CHECK_PREFIX)
  )

  if (live?.configured !== true || checks.length === 0) {
    return {
      status: 'unconfigured',
      failed: [],
      markdown: [
        '## Subgraph deployment health: not configured',
        '',
        'The audit ran without a live deployment section, so no health verdict was produced.',
        'Set the `SUBGRAPH_PERFORMANCE_URL` and `SUBGRAPH_CHAIN_RPC_URL` repository variables',
        'to enable the probe.',
        '',
      ].join('\n'),
    }
  }

  const failed = checks.filter((check) => !check.passed)
  const indexing = live.indexing ?? {}
  const queries = Array.isArray(live.queries) ? live.queries : []
  const lines = [
    `## Subgraph deployment health: ${failed.length === 0 ? 'healthy' : 'degraded'}`,
    '',
    `- Indexed blocks: ${formatNumber(indexing.initialBlock)} to ${formatNumber(indexing.finalBlock)}`,
    `- Source-chain head: ${formatNumber(indexing.finalChainHead)}`,
    `- Block lag: ${formatNumber(indexing.finalBlockLag)}`,
    `- Indexed blocks per second: ${formatNumber(indexing.indexedBlocksPerSecond)}`,
    `- Indexing errors: ${indexing.hasIndexingErrors === true ? 'reported' : 'none reported'}`,
    `- Authentication: ${live.authentication === 'bearer token' ? 'bearer token' : 'none'}`,
    '',
  ]

  if (queries.length > 0) {
    lines.push('| Query | p50 ms | p95 ms | max ms |', '| --- | --- | --- | --- |')
    for (const query of queries) {
      lines.push(
        `| ${query?.name ?? 'unknown'} | ${formatNumber(query?.p50Ms)} | ${formatNumber(
          query?.p95Ms
        )} | ${formatNumber(query?.maxMs)} |`
      )
    }
    lines.push('')
  }

  lines.push('| Check | Actual | Budget | Result |', '| --- | --- | --- | --- |')
  for (const check of checks) lines.push(formatCheck(check))
  lines.push('')

  return {
    status: failed.length === 0 ? 'healthy' : 'degraded',
    failed: failed.map((check) => check.name),
    markdown: lines.join('\n'),
  }
}

function readReport(path) {
  const text = readFileSync(path, 'utf8')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('no JSON object in the audit report')
  return JSON.parse(text.slice(start, end + 1))
}

const entryPoint = process.argv[1] ? resolve(process.argv[1]) : ''
if (entryPoint === fileURLToPath(import.meta.url)) {
  const path = process.argv[2] ?? 'health-report.json'
  let report = null
  try {
    report = readReport(path)
  } catch {
    report = null
  }

  const summary = summarize(report)
  process.stdout.write(`${summary.markdown}\n`)
  process.exitCode = summary.status === 'healthy' ? 0 : summary.status === 'degraded' ? 1 : 2
}
