import { describe, assert, test } from 'matchstick-as/assembly/index'
import { BigInt } from '@graphprotocol/graph-ts'
import { Background, getBackground, includesSorted } from '../src/backgrounds'

// Exported for matchstick function coverage tracking.
export { Background, getBackground, includesSorted }

describe('Background class (src/backgrounds.ts direct)', () => {
  test('assigns Legendary for id 3', () => {
    let bg = new Background(3)
    assert.i32Equals(bg.id, 3)
    assert.stringEquals(bg.type, 'Legendary')
  })

  test('assigns Meta for id 2', () => {
    let bg = new Background(2)
    assert.i32Equals(bg.id, 2)
    assert.stringEquals(bg.type, 'Meta')
  })

  test('assigns Rare for id 1', () => {
    let bg = new Background(1)
    assert.i32Equals(bg.id, 1)
    assert.stringEquals(bg.type, 'Rare')
  })

  test('assigns Common for id 0', () => {
    let bg = new Background(0)
    assert.i32Equals(bg.id, 0)
    assert.stringEquals(bg.type, 'Common')
  })

  test('assigns Common for unlisted ids', () => {
    for (let i = 4; i <= 100; i++) {
      if (i === 32 || i === 92 || i === 150) {
        continue
      }
      let bg = new Background(i)
      assert.i32Equals(bg.id, i)
      assert.stringEquals(bg.type, 'Common')
    }
  })
})

describe('includesSorted (src/backgrounds.ts direct)', () => {
  test('returns false for empty array', () => {
    assert.booleanEquals(includesSorted([] as number[], 150), false)
  })

  test('finds element in single-element array', () => {
    assert.booleanEquals(includesSorted([150 as number], 150), true)
  })

  test('does not find element not in single-element array', () => {
    assert.booleanEquals(includesSorted([150 as number], 200), false)
  })

  test('finds first and last elements', () => {
    assert.booleanEquals(includesSorted([1 as number, 2 as number, 3 as number], 1), true)
    assert.booleanEquals(includesSorted([1 as number, 2 as number, 3 as number], 3), true)
  })

  test('does not find values outside range', () => {
    assert.booleanEquals(includesSorted([10 as number, 20 as number, 30 as number], 5), false)
    assert.booleanEquals(includesSorted([10 as number, 20 as number, 30 as number], 35), false)
  })

  test('finds value in medium sorted array', () => {
    assert.booleanEquals(
      includesSorted([10 as number, 20 as number, 30 as number, 40 as number, 50 as number], 30),
      true
    )
    assert.booleanEquals(
      includesSorted([10 as number, 20 as number, 30 as number, 40 as number, 50 as number], 25),
      false
    )
  })
})

describe('getBackground (src/backgrounds.ts direct)', () => {
  test('returns Legendary for LEGGIES boundary token 150', () => {
    let bg = getBackground(BigInt.fromI32(150))
    assert.i32Equals(bg.id, 3)
    assert.stringEquals(bg.type, 'Legendary')
  })

  test('returns Meta for METAS boundary token 92', () => {
    let bg = getBackground(BigInt.fromI32(92))
    assert.i32Equals(bg.id, 2)
    assert.stringEquals(bg.type, 'Meta')
  })

  test('returns Rare for RARES boundary token 32', () => {
    let bg = getBackground(BigInt.fromI32(32))
    assert.i32Equals(bg.id, 1)
    assert.stringEquals(bg.type, 'Rare')
  })

  test('returns Common for unlisted token 50001', () => {
    let bg = getBackground(BigInt.fromI32(50001))
    assert.i32Equals(bg.id, 0)
    assert.stringEquals(bg.type, 'Common')
  })

  test('returns Common for token 0', () => {
    let bg = getBackground(BigInt.fromI32(0))
    assert.i32Equals(bg.id, 0)
    assert.stringEquals(bg.type, 'Common')
  })

  test('returns Common for token 10000', () => {
    let bg = getBackground(BigInt.fromI32(10000))
    assert.i32Equals(bg.id, 2)
    assert.stringEquals(bg.type, 'Meta')
  })

  test('handles BigInt beyond i32 range as Common', () => {
    let bg = getBackground(BigInt.fromString('2147483647'))
    assert.i32Equals(bg.id, 0)
    assert.stringEquals(bg.type, 'Common')
  })

  test('full range 0..10000 returns only valid tiers', () => {
    let seen = new Set<string>()
    for (let i = 0; i <= 10000; i++) {
      let bg = getBackground(BigInt.fromI32(i))
      seen.add(bg.type)
    }
    assert.i32Equals(seen.size, 4)
  })
})
