// Swipe-to-remove math for route cards: when a sideways drag counts, and how much to reveal

/** Past this share of the card's width, letting go removes the stop. */
export const SWIPE_COMMIT_FRACTION = 0.45;
/** A fling this fast (px/s) removes the stop even if it hasn't gone that far... */
export const SWIPE_FLING_VELOCITY = 700;
/** ...as long as the card moved at least this far (px) the same way. */
export const SWIPE_FLING_MIN_DISTANCE = 80;
/** Sideways drags shorter than this (px) show nothing behind the card. */
export const SWIPE_DEAD_ZONE = 24;

/**
 * Which way a released swipe commits: 1 (right), -1 (left), or 0 to spring back.
 * `distance` is how far the card moved (px), `velocity` how fast it was going (px/s).
 */
export function getSwipeCommit(distance: number, velocity: number, width: number): -1 | 0 | 1 {
  const direction = distance > 0 ? 1 : -1;
  const travelled = Math.abs(distance);
  if (travelled === 0 || width <= 0) return 0;
  if (travelled >= width * SWIPE_COMMIT_FRACTION) return direction;

  const isFling =
    Math.abs(velocity) >= SWIPE_FLING_VELOCITY &&
    Math.sign(velocity) === direction &&
    travelled >= SWIPE_FLING_MIN_DISTANCE;
  return isFling ? direction : 0;
}

/**
 * How visible the "Remove from route" label is (0-1) when the card has moved `distance` px
 * towards that label's side: nothing in the dead zone, fully shown at the commit point.
 */
export function getSwipeReveal(distance: number, width: number): number {
  const commitAt = width * SWIPE_COMMIT_FRACTION;
  if (distance <= SWIPE_DEAD_ZONE || commitAt <= SWIPE_DEAD_ZONE) return 0;
  return Math.min(1, (distance - SWIPE_DEAD_ZONE) / (commitAt - SWIPE_DEAD_ZONE));
}

/** True once the card has gone far enough that letting go removes it. */
export function isSwipeArmed(distance: number, width: number): boolean {
  return width > 0 && Math.abs(distance) >= width * SWIPE_COMMIT_FRACTION;
}

export interface PointerSample {
  x: number;
  /** Event time (ms) */
  time: number;
}

/**
 * Sideways speed (px/s) over the last ~100ms of pointer samples. Uses the events' own
 * timestamps, so a quick flick right after the page sat idle still counts.
 */
export function getPointerVelocity(samples: ReadonlyArray<PointerSample>, windowMs = 100): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = samples[samples.length - 2];
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.time - samples[i].time > windowMs) break;
    first = samples[i];
  }
  const seconds = (last.time - first.time) / 1000;
  return seconds > 0 ? (last.x - first.x) / seconds : 0;
}
