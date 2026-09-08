import { describe, expect, it } from 'bun:test'
import { LEGGIES, METAS, RARES } from '../src/constants'

describe('constants — rarity tables', () => {
  it('LEGGIES contains exactly 104 legendary token ids', () => {
    expect(LEGGIES).toHaveLength(104)
  })

  it('METAS contains exactly 294 meta token ids', () => {
    expect(METAS).toHaveLength(294)
  })

  it('RARES contains exactly 538 rare token ids', () => {
    expect(RARES).toHaveLength(538)
  })

  it('all rarity tables are sorted ascending', () => {
    for (const [label, table] of [
      ['LEGGIES', LEGGIES],
      ['METAS', METAS],
      ['RARES', RARES],
    ] as const) {
      const sorted = table.toSorted((a, b) => a - b)
      expect(table, `${label} should be sorted ascending`).toEqual(sorted)
    }
  })

  it('all rarity tables contain only unique values', () => {
    for (const [label, table] of [
      ['LEGGIES', LEGGIES],
      ['METAS', METAS],
      ['RARES', RARES],
    ] as const) {
      expect(new Set(table).size, `${label} should have no duplicates`).toBe(table.length)
    }
  })

  it('all token ids are within the valid collection range 1..10000', () => {
    for (const table of [LEGGIES, METAS, RARES]) {
      for (const id of table) {
        expect(id).toBeGreaterThanOrEqual(1)
        expect(id).toBeLessThanOrEqual(10000)
        expect(Number.isInteger(id)).toBe(true)
      }
    }
  })

  it('the three tiers are mutually disjoint (no id in two tiers)', () => {
    const metaSet = new Set(METAS)
    const rareSet = new Set(RARES)
    expect(LEGGIES.filter((id) => metaSet.has(id))).toEqual([])
    expect(LEGGIES.filter((id) => rareSet.has(id))).toEqual([])
    expect(METAS.filter((id) => rareSet.has(id))).toEqual([])
  })

  it('combined unique count is 936', () => {
    expect(new Set([...LEGGIES, ...METAS, ...RARES]).size).toBe(936)
  })

  it('contains known boundary and sentinel values', () => {
    // Lowest rare, highest legendary, and max token id sentinel
    expect(RARES[0]).toBe(32)
    expect(RARES).toContain(9985)
    expect(METAS).toContain(92)
    expect(METAS).toContain(10000)
    expect(LEGGIES).toContain(150)
    expect(LEGGIES).toContain(9924)
  })

  it('LEGGIES first and last entries are stable regression anchors', () => {
    expect(LEGGIES[0]).toBe(150)
    expect(LEGGIES[LEGGIES.length - 1]).toBe(9924)
  })

  it('METAS first and last entries are stable regression anchors', () => {
    expect(METAS[0]).toBe(92)
    expect(METAS[METAS.length - 1]).toBe(10000)
  })

  it('RARES first and last entries are stable regression anchors', () => {
    expect(RARES[0]).toBe(32)
    expect(RARES[RARES.length - 1]).toBe(9985)
  })

  it('no table contains 0 or negative ids', () => {
    for (const table of [LEGGIES, METAS, RARES]) {
      expect(table.every((id) => id > 0)).toBe(true)
    }
  })
})
