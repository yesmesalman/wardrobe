import {
  DocumentDirectoryPath,
  exists,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import {DEFAULT_ALIGN} from '../constants';
import type {Garment} from '../types';

// Only file names are persisted: the app container path can change between
// app updates on iOS, so absolute paths are resolved at runtime.
const garmentsDir = () => `${DocumentDirectoryPath}/garments`;
const indexPath = () => `${DocumentDirectoryPath}/garments.json`;
const filePath = (fileName: string) => `${garmentsDir()}/${fileName}`;

/** URI for React Native's <Image> to show a stored file. */
export function fileUri(fileName: string): string {
  return `file://${filePath(fileName)}`;
}

export async function loadGarments(): Promise<Garment[]> {
  try {
    if (!(await exists(indexPath()))) {
      return [];
    }
    const parsed = JSON.parse(await readFile(indexPath(), 'utf8'));
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Garments saved before "fit" mode existed only have a printed photo.
    return parsed.map(g => ({
      ...g,
      mode: g.mode ?? 'print',
      align: g.align ?? DEFAULT_ALIGN,
    }));
  } catch {
    return [];
  }
}

export async function saveGarments(garments: Garment[]): Promise<void> {
  await writeFile(indexPath(), JSON.stringify(garments), 'utf8');
}

export interface GarmentFiles {
  /** Base64 JPEG of the photo. */
  photoBase64: string;
  /** Base64 PNG of the garment cut out of the photo (fit mode). */
  cutoutBase64?: string;
  /** Base64 JPEG snapshot of the garment in 3D. */
  thumbBase64: string;
}

/** Stores a garment's photo, cut-out and 3D snapshot; returns file names. */
export async function saveGarmentFiles(
  id: string,
  {photoBase64, cutoutBase64, thumbBase64}: GarmentFiles,
): Promise<{photoFile: string; cutoutFile?: string; thumbFile: string}> {
  await mkdir(garmentsDir());
  const photoFile = `${id}.jpg`;
  const thumbFile = `${id}-thumb.jpg`;
  await writeFile(filePath(photoFile), photoBase64, 'base64');
  await writeFile(filePath(thumbFile), thumbBase64, 'base64');
  let cutoutFile: string | undefined;
  if (cutoutBase64) {
    cutoutFile = `${id}-cutout.png`;
    await writeFile(filePath(cutoutFile), cutoutBase64, 'base64');
  }
  return {photoFile, cutoutFile, thumbFile};
}

export function readFileBase64(fileName: string): Promise<string> {
  return readFile(filePath(fileName), 'base64');
}

export async function deleteGarmentFiles(garment: Garment): Promise<void> {
  const names = [garment.photoFile, garment.thumbFile, garment.cutoutFile];
  await Promise.all(
    names.map(async name => {
      if (!name) {
        return;
      }
      const path = filePath(name);
      if (await exists(path)) {
        await unlink(path);
      }
    }),
  );
}
