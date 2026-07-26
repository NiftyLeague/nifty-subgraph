// Pure JS mirrors of the pure logic in src/custom-mappings.ts.
// These functions are extracted from the AssemblyScript event handlers
// so they can be unit-tested under bun:test without graph-ts dependencies.

// Mirrors the owner character-count update in handleTransfer:
//   let newCount = previousOwner.characterCount - 1
//   previousOwner.characterCount = newCount > 0 ? newCount : 0
export function decrementOwnerCount(currentCount: number): number {
  const newCount = currentCount - 1
  return newCount > 0 ? newCount : 0
}

// Mirrors the owner character-count update in handleTransfer:
//   newOwner.characterCount = newOwner.characterCount + 1
export function incrementOwnerCount(currentCount: number): number {
  return currentCount + 1
}

// Mirrors the name-history update in handleNameUpdated:
//   let nameHistory = character.nameHistory || new Array<string>()
//   if (event.params.previousName.length && nameHistory !== null)
//     nameHistory.push(event.params.previousName)
export function pushNameHistory(nameHistory: string[] | null, previousName: string): string[] {
  const history = nameHistory !== null ? nameHistory : []
  if (previousName.length > 0) {
    history.push(previousName)
  }
  return history
}
