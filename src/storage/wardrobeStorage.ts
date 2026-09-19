import {
  DocumentDirectoryPath,
  exists,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveGarments(garments: Garment[]): Promise<void> {
  await writeFile(indexPath(), JSON.stringify(garments), 'utf8');
}

/** Stores a garment's photo and its 3D snapshot (both base64 JPEG). */
export async function saveGarmentFiles(
  id: string,
  photoBase64: string,
  thumbBase64: string,
): Promise<{photoFile: string; thumbFile: string}> {
  await mkdir(garmentsDir());
  const photoFile = `${id}.jpg`;
  const thumbFile = `${id}-thumb.jpg`;
  await writeFile(filePath(photoFile), photoBase64, 'base64');
  await writeFile(filePath(thumbFile), thumbBase64, 'base64');
  return {photoFile, thumbFile};
}

export function readPhotoBase64(photoFile: string): Promise<string> {
  return readFile(filePath(photoFile), 'base64');
}

export async function deleteGarmentFiles(garment: Garment): Promise<void> {
  await Promise.all(
    [garment.photoFile, garment.thumbFile].map(async name => {
      const path = filePath(name);
      if (await exists(path)) {
        await unlink(path);
      }
    }),
  );
}
