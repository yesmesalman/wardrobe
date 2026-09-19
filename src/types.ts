export type GarmentKind = 'shirt' | 'pants';

export interface Garment {
  id: string;
  kind: GarmentKind;
  /** File name of the user's photo inside the app's garments directory. */
  photoFile: string;
  /** File name of the 3D snapshot shown on the library card. */
  thumbFile: string;
  /** Fabric colour of the blank 3D model (hex). */
  color: string;
  createdAt: number;
}
