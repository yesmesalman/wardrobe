// Types for the parts of garmentGeometry.js the app itself uses.

type Point = [number, number];

/** The default garment seen flat from the front (y up), for the camera's guide. */
export function frontOutline(kind: 'shirt' | 'pants'): {
  /** Closed outline: the long-sleeve shirt, or the long pants. */
  outline: Point[];
  /** Where short sleeves (shirts) or shorts (pants) end, one line per side. */
  cuffs: [Point, Point][];
};
