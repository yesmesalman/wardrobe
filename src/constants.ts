import type {GarmentKind} from './types';

/** How many shirts and how many pants the wardrobe holds. */
export const MAX_PER_KIND = 20;

export const KIND_LABELS: Record<GarmentKind, {singular: string; plural: string}> =
  {
    shirt: {singular: 'Shirt', plural: 'Shirts'},
    pants: {singular: 'Pants', plural: 'Pants'},
  };

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
  accent: '#2F3E46',
  accentText: '#FFFFFF',
  danger: '#B3402E',
  sceneTop: '#FBFAF7',
  sceneBottom: '#ECE7DF',
};
