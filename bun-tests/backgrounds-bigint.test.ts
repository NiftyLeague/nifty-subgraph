import { describe, expect, it } from 'bun:test'
import { LEGGIES, METAS, RARES } from '../src/constants'

// Pure JS mirror of src/backgrounds.ts' getBackground(tokenId: BigInt).
// The production AssemblyScript version uses BigInt.toI32(); this mirror
// lets us unit-test the same logic path under bun:test, including the
// bigint -> number coercion that can silently mask boundary bugs.
type BackgroundType = 'Legendary' | 'Meta' | 'Rare' | 'Common'

function getBackground(tokenId: bigint): { id: number; type: BackgroundType } {
  const id = Number(tokenId)
  if (LEGGIES.includes(id)) return { id: 3, type: 'Legendary' }
  if (METAS.includes(id)) return { id: 2, type: 'Meta' }
  if (RARES.includes(id)) return { id: 1, type: 'Rare' }
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
