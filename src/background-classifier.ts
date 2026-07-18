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
