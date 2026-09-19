import {useCallback, useEffect, useMemo, useState} from 'react';
import {MAX_PER_KIND} from '../constants';
import {
  deleteGarmentFiles,
  loadGarments,
  saveGarmentFiles,
  saveGarments,
} from '../storage/wardrobeStorage';
import type {Garment, GarmentKind} from '../types';

export interface NewGarment {
  kind: GarmentKind;
  color: string;
  /** Base64 JPEG of the user's photo. */
  photoBase64: string;
  /** Base64 JPEG snapshot of the garment in 3D. */
  thumbBase64: string;
}

export function useWardrobe() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadGarments()
      .then(setGarments)
      .finally(() => setLoaded(true));
  }, []);

  // Persist every change once the initial load has finished.
  useEffect(() => {
    if (loaded) {
      saveGarments(garments).catch(e =>
        console.warn('Could not save the wardrobe', e),
      );
    }
  }, [garments, loaded]);

  const counts = useMemo(
    () => ({
      shirt: garments.filter(g => g.kind === 'shirt').length,
      pants: garments.filter(g => g.kind === 'pants').length,
    }),
    [garments],
  );

  const isFull = useCallback(
    (kind: GarmentKind) => counts[kind] >= MAX_PER_KIND,
    [counts],
  );

  const add = useCallback(
    async ({kind, color, photoBase64, thumbBase64}: NewGarment) => {
      if (counts[kind] >= MAX_PER_KIND) {
        throw new Error(`You can only keep ${MAX_PER_KIND} of each garment.`);
      }
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const files = await saveGarmentFiles(id, photoBase64, thumbBase64);
      const garment: Garment = {id, kind, color, createdAt: Date.now(), ...files};
      setGarments(prev => [garment, ...prev]);
      return garment;
    },
    [counts],
  );

  const remove = useCallback((garment: Garment) => {
    deleteGarmentFiles(garment).catch(e =>
      console.warn('Could not delete garment files', e),
    );
    setGarments(prev => prev.filter(g => g.id !== garment.id));
  }, []);

  return {garments, loaded, counts, isFull, add, remove};
}
