export type GarmentKind = 'shirt' | 'pants';

/**
 * How the photo is shown on the blank model:
 *  - fit:   the garment cut out of the photo covers the whole model
 *  - print: the photo is a small decal on the chest / thigh
 */
export type PhotoMode = 'fit' | 'print';

/**
 * Where the photo sits over the model's front, relative to the model's
 * front-on outline: scale (1 = same size as the model) and offset.
 */
export interface Align {
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}

export interface Garment {
  id: string;
  kind: GarmentKind;
  mode: PhotoMode;
  /** File name of the user's photo inside the app's garments directory. */
  photoFile: string;
  /** File name of the garment cut out of the photo (fit mode only). */
  cutoutFile?: string;
  /** File name of the 3D snapshot shown on the library card. */
  thumbFile: string;
  /** Fabric colour of the blank 3D model (hex). */
  color: string;
  align: Align;
  createdAt: number;
}
