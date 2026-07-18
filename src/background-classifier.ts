// Pure, framework-agnostic background classification.
// Mirrors the logic in src/backgrounds.ts (AssemblyScript) but operates on
// plain JS numbers so it can be unit-tested under bun:test. The subgraph build
// keeps its graph-ts version; this is the bun-testable equivalent.
import { LEGGIES, METAS, RARES } from './constants'

export type BackgroundType = 'Legendary' | 'Meta' | 'Rare' | 'Common'

const LEGGIES_SET = new Set<number>(LEGGIES)
const METAS_SET = new Set<number>(METAS)
const RARES_SET = new Set<number>(RARES)

export function classifyBackground(tokenId: number): BackgroundType {
  if (LEGGIES_SET.has(tokenId)) return 'Legendary'
  if (METAS_SET.has(tokenId)) return 'Meta'
  if (RARES_SET.has(tokenId)) return 'Rare'
  return 'Common'
}
