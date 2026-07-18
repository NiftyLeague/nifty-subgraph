import { describe, expect, it } from 'bun:test'
import { LEGGIES, METAS, RARES } from '../src/constants'
import { classifyBackground } from '../src/background-classifier'

describe('background rarity tables', () => {
  it('exposes non-empty, sorted, deduplicated rarity arrays', () => {
    for (const table of [LEGGIES, METAS, RARES]) {
      expect(table.length).toBeGreaterThan(0)
      const sorted = [...table].sort((a, b) => a - b)
      expect(table).toEqual(sorted)
      expect(new Set(table).size).toBe(table.length)
    }
  })

  it('keeps the three rarity tiers disjoint (no token is in two tiers)', () => {
    const overlap = LEGGIES.filter((id) => METAS.includes(id) || RARES.includes(id))
    expect(overlap).toHaveLength(0)
  })
})

describe('classifyBackground', () => {
  it('classifies a legendary token id', () => {
    expect(classifyBackground(LEGGIES[0])).toBe('Legendary')
  })

  it('classifies a meta token id', () => {
    expect(classifyBackground(METAS[0])).toBe('Meta')
  })

  it('classifies a rare token id', () => {
    expect(classifyBackground(RARES[0])).toBe('Rare')
  })

  it('falls back to Common for an unlisted token id', () => {
    // 1 is not in any tier table
    expect(classifyBackground(1)).toBe('Common')
  })

  it('never returns an unknown tier', () => {
    const seen = new Set<string>()
    for (let id = 0; id < 10000; id++) seen.add(classifyBackground(id))
    expect([...seen]).toEqual(expect.arrayContaining(['Legendary', 'Meta', 'Rare', 'Common']))
  })
})
