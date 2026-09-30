import { describe, expect, it } from 'bun:test'
import { summarize } from '../scripts/health-summary.mjs'

type LiveReport = {
  live: {
    configured: boolean
    authentication: string
    queries?: Array<{ name: string; p50Ms: number; p95Ms: number; maxMs: number }>
    indexing?: Record<string, unknown>
  }
  checks: Array<{ name: string; actual: number; operator: string; budget: number; passed: boolean }>
}

function report(overrides: Partial<LiveReport> = {}): LiveReport {
  return {
    live: {
      configured: true,
      authentication: 'bearer token',
      queries: [{ name: 'metadata', p50Ms: 90, p95Ms: 120, maxMs: 200 }],
      indexing: {
        initialBlock: 100,
        finalBlock: 110,
        finalChainHead: 115,
        finalBlockLag: 5,
        indexedBlocksPerSecond: 0.67,
        hasIndexingErrors: false,
      },
    },
    checks: [
      { name: 'local.mainnetBuildMs', actual: 4200, operator: '<=', budget: 10000, passed: true },
      { name: 'live.metadata.p95Ms', actual: 120, operator: '<=', budget: 1500, passed: true },
      { name: 'live.indexing.blockLag', actual: 5, operator: '<=', budget: 25, passed: true },
      {
        name: 'live.indexing.hasIndexingErrors',
        actual: 0,
        operator: '<=',
        budget: 0,
        passed: true,
      },
    ],
    ...overrides,
  }
}

describe('health summary', () => {
  it('reports healthy when every live check passes', () => {
    const summary = summarize(report())
    expect(summary.status).toBe('healthy')
    expect(summary.failed).toEqual([])
  })

  it('ignores failing local checks when judging the deployment', () => {
    const failing = report()
    failing.checks[0] = { ...failing.checks[0], passed: false }
    const summary = summarize(failing)
    expect(summary.status).toBe('healthy')
  })

  it('reports degraded and names the failing live checks', () => {
    const degraded = report()
    degraded.checks[2] = { ...degraded.checks[2], actual: 900, passed: false }
    degraded.live.indexing = {
      ...degraded.live.indexing,
      finalBlockLag: 900,
      hasIndexingErrors: true,
    }
    const summary = summarize(degraded)
    expect(summary.status).toBe('degraded')
    expect(summary.failed).toEqual(['live.indexing.blockLag'])
    expect(summary.markdown).toContain('Block lag: 900')
    expect(summary.markdown).toContain('Indexing errors: reported')
  })

  it('never echoes the endpoint or the token', () => {
    const summary = summarize({
      ...report(),
      endpoint: 'https://gateway.example/query/7093/nifty-league-sepolia',
      token: 'super-secret-token',
    } as unknown as LiveReport)
    expect(summary.markdown).not.toContain('gateway.example')
    expect(summary.markdown).not.toContain('super-secret-token')
    expect(summary.markdown).not.toContain('7093')
  })

  it('reports unconfigured when the live section is absent', () => {
    const summary = summarize({
      live: { configured: false, status: 'skipped' },
      checks: [{ name: 'local.codegenMs', actual: 1, operator: '<=', budget: 2, passed: true }],
    } as unknown as LiveReport)
    expect(summary.status).toBe('unconfigured')
  })

  it('reports unreadable for a missing or malformed report', () => {
    expect(summarize(null).status).toBe('unreadable')
    expect(summarize({ live: {} } as unknown as LiveReport).status).toBe('unreadable')
  })
})
