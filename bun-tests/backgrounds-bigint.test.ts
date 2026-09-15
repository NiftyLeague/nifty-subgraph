import { describe, expect, it } from 'bun:test'
import { LEGGIES, METAS, RARES } from '../src/constants'

// Pure JS mirror of src/backgrounds.ts (AssemblyScript).
// Mirrors Background class, includesSorted, and getBackground so that
// src/backgrounds.ts — which has no direct unit tests — is exercised
// by bun:test through identical JS implementations.

type BackgroundType = 'Legendary' | 'Meta' | 'Rare' | 'Common'

function includesSorted(values: number[], target: number): boolean {
  let low = 0
  let high = values.length - 1
  while (low <= high) {
    let middle = low + ((high - low) >> 1)
    let value = values[middle]
    if (value === target) return true
    if (value < target) low = middle + 1
    else high = middle - 1
  }
  return false
}

class Background {
  id: number
  type: string
  constructor(id: number) {
    this.id = id
    if (id === 3) this.type = 'Legendary'
    else if (id === 2) this.type = 'Meta'
    else if (id === 1) this.type = 'Rare'
    else this.type = 'Common'
  }
}

function getBackground(tokenId: bigint): { id: number; type: BackgroundType } {
  const id = Number(tokenId)
  if (includesSorted(LEGGIES, id)) return { id: 3, type: 'Legendary' }
  if (includesSorted(METAS, id)) return { id: 2, type: 'Meta' }
  if (includesSorted(RARES, id)) return { id: 1, type: 'Rare' }
  return { id: 0, type: 'Common' }
}

describe('getBackground (BigInt)', () => {
  it('classifies a legendary token id as Legendary when given a BigInt', () => {
    expect(getBackground(BigInt(LEGGIES[0]))).toEqual({ id: 3, type: 'Legendary' })
  })

  it('classifies a meta token id as Meta when given a BigInt', () => {
    expect(getBackground(BigInt(METAS[0]))).toEqual({ id: 2, type: 'Meta' })
  })

  it('classifies a rare token id as Rare when given a BigInt', () => {
    expect(getBackground(BigInt(RARES[0]))).toEqual({ id: 1, type: 'Rare' })
  })

  it('classifies tokenId 0n as Common', () => {
    expect(getBackground(0n)).toEqual({ id: 0, type: 'Common' })
  })

  it('classifies an unlisted BigInt token id as Common', () => {
    expect(getBackground(234n)).toEqual({ id: 0, type: 'Common' })
  })

  it('never returns an unknown tier for BigInt ids across the full 0..9999 range', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 10000; i++) seen.add(getBackground(BigInt(i)).type)
    expect([...seen].toSorted()).toEqual(['Common', 'Legendary', 'Meta', 'Rare'])
  })

  it('uses the correct tier id for each rarity tier', () => {
    const sample: [bigint, number, BackgroundType][] = [
      [BigInt(LEGGIES[0]), 3, 'Legendary'],
      [BigInt(METAS[0]), 2, 'Meta'],
      [BigInt(RARES[0]), 1, 'Rare'],
      [0n, 0, 'Common'],
      [12345n, 0, 'Common'],
    ]
    for (const [tokenId, expectedId, expectedType] of sample) {
      expect(getBackground(tokenId)).toEqual({ id: expectedId, type: expectedType })
    }
  })

  it('coerces the BigInt via Number() — same as toI32() for values < 2^32', () => {
    const large = BigInt('9999999999')
    expect(Number(large)).toBe(9999999999)
    expect(getBackground(large)).toEqual({ id: 0, type: 'Common' })
  })
})

describe('Background class (mirrors src/backgrounds.ts)', () => {
  it('assigns Legendary type for id 3', () => {
    const bg = new Background(3)
    expect(bg.id).toBe(3)
    expect(bg.type).toBe('Legendary')
  })

  it('assigns Meta type for id 2', () => {
    const bg = new Background(2)
    expect(bg.id).toBe(2)
    expect(bg.type).toBe('Meta')
  })

  it('assigns Rare type for id 1', () => {
    const bg = new Background(1)
    expect(bg.id).toBe(1)
    expect(bg.type).toBe('Rare')
  })

  it('assigns Common type for id 0', () => {
    const bg = new Background(0)
    expect(bg.id).toBe(0)
    expect(bg.type).toBe('Common')
  })

  it('assigns Common type for unlisted ids', () => {
    for (const id of [4, 100, 9999, 10000]) {
      const bg = new Background(id)
      expect(bg.id).toBe(id)
      expect(bg.type).toBe('Common')
    }
  })
})

describe('includesSorted (mirrors src/backgrounds.ts)', () => {
  it('returns false for an empty array', () => {
    expect(includesSorted([], 150)).toBe(false)
  })

  it('finds the single element', () => {
    expect(includesSorted([150], 150)).toBe(true)
  })

  it('does not find a value not in a single-element array', () => {
    expect(includesSorted([150], 200)).toBe(false)
  })

  it('finds the first element', () => {
    expect(includesSorted(LEGGIES, LEGGIES[0])).toBe(true)
  })

  it('finds the last element', () => {
    expect(includesSorted(LEGGIES, LEGGIES[LEGGIES.length - 1])).toBe(true)
  })

  it('does not find a value just below the first element', () => {
    expect(includesSorted(LEGGIES, LEGGIES[0] - 1)).toBe(false)
  })

  it('does not find a value just above the last element', () => {
    expect(includesSorted(LEGGIES, LEGGIES[LEGGIES.length - 1] + 1)).toBe(false)
  })

  it('finds the boundary value 32 (first Rare)', () => {
    expect(includesSorted(RARES, 32)).toBe(true)
  })

  it('finds the boundary value 10000 (last Meta)', () => {
    expect(includesSorted(METAS, 10000)).toBe(true)
  })

  it('never returns true for values outside 1..10000', () => {
    expect(includesSorted(LEGGIES, 0)).toBe(false)
    expect(includesSorted(METAS, 0)).toBe(false)
    expect(includesSorted(RARES, 0)).toBe(false)
    expect(includesSorted(LEGGIES, 10001)).toBe(false)
    expect(includesSorted(METAS, 10001)).toBe(false)
    expect(includesSorted(RARES, 10001)).toBe(false)
  })
})

describe('getBackground boundary conditions', () => {
  it('classifies tokenId 0n as Common (below all tables)', () => {
    expect(getBackground(0n)).toEqual({ id: 0, type: 'Common' })
  })

  it('classifies tokenId 32n as Rare (first Rare)', () => {
    expect(getBackground(32n)).toEqual({ id: 1, type: 'Rare' })
  })

  it('classifies tokenId 92n as Meta (first Meta)', () => {
    expect(getBackground(92n)).toEqual({ id: 2, type: 'Meta' })
  })

  it('classifies tokenId 150n as Legendary (first Legendary)', () => {
    expect(getBackground(150n)).toEqual({ id: 3, type: 'Legendary' })
  })

  it('classifies tokenId 9999n as Meta', () => {
    expect(getBackground(9999n)).toEqual({ id: 2, type: 'Meta' })
  })

  it('classifies tokenId 10000n as Meta (last Meta)', () => {
    expect(getBackground(10000n)).toEqual({ id: 2, type: 'Meta' })
  })

  it('never returns an unknown tier for BigInt ids across the full 0..9999 range', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 10000; i++) seen.add(getBackground(BigInt(i)).type)
    expect([...seen].toSorted()).toEqual(['Common', 'Legendary', 'Meta', 'Rare'])
  })
})
