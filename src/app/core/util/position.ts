/**
 * Fractional positioning helpers for ordering lists & cards without
 * having to renumber every sibling on each move.
 */
const STEP = 1000;

export function positionAtEnd(items: { position: number }[]): number {
  if (!items.length) return STEP;
  return Math.max(...items.map((i) => i.position)) + STEP;
}

export function positionAtStart(items: { position: number }[]): number {
  if (!items.length) return STEP;
  return Math.min(...items.map((i) => i.position)) / 2;
}

/** Compute a position for inserting at index `targetIndex` within ordered `items`. */
export function positionForIndex(items: { position: number }[], targetIndex: number): number {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  if (sorted.length === 0) return STEP;
  if (targetIndex <= 0) return sorted[0].position / 2;
  if (targetIndex >= sorted.length) return sorted[sorted.length - 1].position + STEP;
  const prev = sorted[targetIndex - 1].position;
  const next = sorted[targetIndex].position;
  return (prev + next) / 2;
}
