export const SLOT_MINUTES = 60; // also the fixed session length: SESSION has no end column

const MIN_MS = 60_000;

/** Two sessions clash when their starts are less than one slot apart. */
export const overlaps = (aMs: number, bMs: number) => Math.abs(aMs - bMs) < SLOT_MINUTES * MIN_MS;
