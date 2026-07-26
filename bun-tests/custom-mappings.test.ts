import { describe, expect, it } from 'bun:test'
import {
  decrementOwnerCount,
  incrementOwnerCount,
  pushNameHistory,
} from '../src/custom-mappings-bun'

describe('decrementOwnerCount', () => {
  it('decrements a positive count', () => {
    expect(decrementOwnerCount(5)).toBe(4)
  })

  it('returns 0 when count would go below zero', () => {
    expect(decrementOwnerCount(1)).toBe(0)
  })

  it('returns 0 when count is already 0', () => {
    expect(decrementOwnerCount(0)).toBe(0)
  })

  it('returns 0 when count is 1', () => {
    expect(decrementOwnerCount(1)).toBe(0)
  })
})

describe('incrementOwnerCount', () => {
  it('increments a count', () => {
    expect(incrementOwnerCount(0)).toBe(1)
  })

  it('increments a positive count', () => {
    expect(incrementOwnerCount(3)).toBe(4)
  })
})

describe('pushNameHistory', () => {
  it('pushes a non-empty previousName onto a new array', () => {
    const result = pushNameHistory(null, 'OldName')
    expect(result).toEqual(['OldName'])
  })

  it('appends to an existing history array', () => {
    const result = pushNameHistory(['FirstName'], 'SecondName')
    expect(result).toEqual(['FirstName', 'SecondName'])
  })

  it('does not push an empty previousName', () => {
    const result = pushNameHistory(null, '')
    expect(result).toEqual([])
  })

  it('does not push an empty previousName onto existing history', () => {
    const result = pushNameHistory(['Existing'], '')
    expect(result).toEqual(['Existing'])
  })

  it('preserves an empty-string previousName check (length 0 falsy)', () => {
    // In AssemblyScript, previousName.length is checked; empty string has length 0
    const result = pushNameHistory(['A'], '')
    expect(result).toEqual(['A'])
  })
})
