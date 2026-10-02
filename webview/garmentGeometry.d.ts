// Types for the parts of garmentGeometry.js the app itself uses.

type Point = [number, number];

/**
 * The standard garment of a body type (the man's by default) seen flat from
 * the front (y up), for the camera's guide.
 */
export function frontOutline(
  kind: 'shirt' | 'pants',
  body?: 'man' | 'woman',
): {
  /** Closed outline: the long-sleeve shirt, or the long pants. */
  outline: Point[];
  /** Where short sleeves (shirts) or shorts (pants) end, one line per side. */
  cuffs: [Point, Point][];
};
