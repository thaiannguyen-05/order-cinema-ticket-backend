/**
 * Convert decimal amount to smallest integer unit (e.g. VND cents = * 100).
 * Uses Math.round to avoid floating point precision loss.
 */
export function toIntAmount(decimal: number): number {
  return Math.round(decimal * 100);
}

/**
 * Convert stored integer amount back to decimal representation.
 */
export function toDecimalAmount(intAmount: number): number {
  return Number((intAmount / 100).toFixed(2));
}
