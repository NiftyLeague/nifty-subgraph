import { describe, expect, it } from 'bun:test'
import { LEGGIES, METAS, RARES } from '../src/constants'
import { classifyBackground, createBackground, includesSorted } from '../src/background-classifier'

describe('background rarity tables', () => {
  it('exposes non-empty, sorted, deduplicated rarity arrays', () => {
    for (const table of [LEGGIES, METAS, RARES]) {
      expect(table.length).toBeGreaterThan(0)
      const sorted = table.toSorted((a, b) => a - b)
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
  it('keeps binary-search classification equivalent to the rarity tables', () => {
    for (let id = 0; id <= 10000; id++) {
      const expected = LEGGIES.includes(id)
        ? 'Legendary'
        : METAS.includes(id)
          ? 'Meta'
          : RARES.includes(id)
            ? 'Rare'
            : 'Common'
      expect(classifyBackground(id)).toBe(expected)
    }
  })

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

describe('includesSorted', () => {
  it('handles empty, boundary, present, and absent values', () => {
    expect(includesSorted([], 1)).toBe(false)
    expect(includesSorted([2, 4, 6, 8], 2)).toBe(true)
    expect(includesSorted([2, 4, 6, 8], 8)).toBe(true)
    expect(includesSorted([2, 4, 6, 8], 5)).toBe(false)
    expect(includesSorted([2, 4, 6, 8], 9)).toBe(false)
  })
})

describe('createBackground', () => {
  it('assigns Legendary type for id 3', () => {
    expect(createBackground(3)).toEqual({ id: 3, type: 'Legendary' })
  })

  it('assigns Meta type for id 2', () => {
    expect(createBackground(2)).toEqual({ id: 2, type: 'Meta' })
  })

  it('assigns Rare type for id 1', () => {
    expect(createBackground(1)).toEqual({ id: 1, type: 'Rare' })
  })

  it('assigns Common type for id 0', () => {
    expect(createBackground(0)).toEqual({ id: 0, type: 'Common' })
  })

  it('assigns Common type for unlisted token ids', () => {
    expect(createBackground(234)).toEqual({ id: 234, type: 'Common' })
    expect(createBackground(9999)).toEqual({ id: 9999, type: 'Common' })
  })

  it('never returns an unknown tier', () => {
    const seen = new Set<string>()
    for (let id = 0; id < 10000; id++) seen.add(createBackground(id).type)
    expect([...seen].toSorted()).toEqual(['Common', 'Legendary', 'Meta', 'Rare'])
  })
})
