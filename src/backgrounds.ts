import { BigInt } from '@graphprotocol/graph-ts'
import { LEGGIES, METAS, RARES } from './constants'

export class Background {
  id: i32
  type: string

  constructor(id: i32) {
    this.id = id
    if (id === 3) this.type = 'Legendary'
    else if (id === 2) this.type = 'Meta'
    else if (id === 1) this.type = 'Rare'
    else this.type = 'Common'
  }
}

export function includesSorted(values: number[], target: number): boolean {
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

export function getBackground(tokenId: BigInt): Background {
  let id = tokenId.toI32()
  if (includesSorted(LEGGIES, id)) {
    return new Background(3)
  } else if (includesSorted(METAS, id)) {
    return new Background(2)
  } else if (includesSorted(RARES, id)) {
    return new Background(1)
  }
  return new Background(0)
}
