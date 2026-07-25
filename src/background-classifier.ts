// Pure, framework-agnostic background classification.
// Mirrors the logic in src/backgrounds.ts (AssemblyScript) but operates on
// plain JS numbers so it can be unit-tested under bun:test. The subgraph build
// keeps its graph-ts version; this is the bun-testable equivalent.
import { LEGGIES, METAS, RARES } from './constants'

export type BackgroundType = 'Legendary' | 'Meta' | 'Rare' | 'Common'

export function classifyBackground(tokenId: number): BackgroundType {
  if (LEGGIES.indexOf(tokenId) !== -1) return 'Legendary'
  if (METAS.indexOf(tokenId) !== -1) return 'Meta'
  if (RARES.indexOf(tokenId) !== -1) return 'Rare'
  return 'Common'
}

// Mirrors the Background class constructor in src/backgrounds.ts.
// Returns a plain JS object instead of an AS class instance.
export function createBackground(id: number): { id: number; type: BackgroundType } {
  if (id === 3) return { id, type: 'Legendary' }
  else if (id === 2) return { id, type: 'Meta' }
  else if (id === 1) return { id, type: 'Rare' }
  else return { id, type: 'Common' }
}
