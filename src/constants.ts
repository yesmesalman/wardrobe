import type {Align, GarmentKind, Variant} from './types';

/** How many shirts and how many pants the wardrobe holds. */
export const MAX_PER_KIND = 5;

export const KIND_LABELS: Record<GarmentKind, {singular: string; plural: string}> =
  {
    shirt: {singular: 'Shirt', plural: 'Shirts'},
    pants: {singular: 'Pants', plural: 'Pants'},
  };

export const DEFAULT_ALIGN: Align = {sx: 1, sy: 1, ox: 0, oy: 0};

export const GARMENT_COLORS = [
  {name: 'Snow', hex: '#F2F0EB'},
  {name: 'Charcoal', hex: '#3A3D44'},
  {name: 'Black', hex: '#1B1C1F'},
  {name: 'Navy', hex: '#26365C'},
  {name: 'Sky', hex: '#6E9BC9'},
  {name: 'Forest', hex: '#33553F'},
  {name: 'Olive', hex: '#7A7B4C'},
  {name: 'Sand', hex: '#CBB48F'},
  {name: 'Brick', hex: '#A5452F'},
  {name: 'Rose', hex: '#D9A0A6'},
  {name: 'Plum', hex: '#6B3B5E'},
  {name: 'Denim', hex: '#4B6584'},
] as const;

/** The options offered on each add screen; the first one is the default. */
export const VARIANTS: Record<GarmentKind, {value: Variant; label: string}[]> =
  {
    shirt: [
      {value: 'short-sleeve', label: 'Short sleeves'},
      {value: 'long-sleeve', label: 'Long sleeves'},
    ],
    pants: [
      {value: 'long-pants', label: 'Long pants'},
      {value: 'shorts', label: 'Shorts'},
    ],
  };

export const VARIANT_LABELS: Record<Variant, string> = {
  'short-sleeve': 'Short-sleeve shirt',
  'long-sleeve': 'Long-sleeve shirt',
  'long-pants': 'Long pants',
  shorts: 'Shorts',
};

export const DEFAULT_COLOR: Record<GarmentKind, string> = {
  shirt: '#F2F0EB',
  pants: '#26365C',
};

export const theme = {
  background: '#F6F3EE',
  surface: '#FFFFFF',
  ink: '#1C1B1A',
  muted: '#77726B',
  line: '#E4DFD7',
  cardBorder: '#CFC8BC',
  accent: '#2F3E46',
  accentText: '#FFFFFF',
  danger: '#B3402E',
  sceneTop: '#FBFAF7',
  sceneBottom: '#ECE7DF',
};
