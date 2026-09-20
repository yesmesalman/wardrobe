/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {MAX_PER_KIND} from '../src/constants';
import {useWardrobe} from '../src/hooks/useWardrobe';
import * as storage from '../src/storage/wardrobeStorage';

jest.mock('../src/storage/wardrobeStorage', () => ({
  loadGarments: jest.fn(() => Promise.resolve([])),
  saveGarments: jest.fn(() => Promise.resolve()),
  saveGarmentFiles: jest.fn((id: string) =>
    Promise.resolve({photoFile: `${id}.jpg`, thumbFile: `${id}-thumb.jpg`}),
  ),
  deleteGarmentFiles: jest.fn(() => Promise.resolve()),
}));

type Wardrobe = ReturnType<typeof useWardrobe>;

async function renderWardrobe() {
  const ref: {current: Wardrobe | null} = {current: null};
  function Harness() {
    ref.current = useWardrobe();
    return null;
  }
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<Harness />);
  });
  return ref as {current: Wardrobe};
}

const addMany = async (
  wardrobe: {current: Wardrobe},
  kind: 'shirt' | 'pants',
  count: number,
) => {
  for (let i = 0; i < count; i++) {
    await ReactTestRenderer.act(async () => {
      await wardrobe.current.add({
        kind,
        variant: kind === 'shirt' ? ('short-sleeve' as const) : ('long-pants' as const),
        mode: 'print' as const,
        color: '#fff',
        align: {sx: 1, sy: 1, ox: 0, oy: 0},
        photoBase64: 'cGhvdG8=',
        thumbBase64: 'dGh1bWI=',
      });
    });
  }
};

test('keeps at most 20 shirts and 20 pants, independently', async () => {
  const wardrobe = await renderWardrobe();

  await addMany(wardrobe, 'shirt', MAX_PER_KIND);
  expect(wardrobe.current.counts).toEqual({shirt: MAX_PER_KIND, pants: 0});
  expect(wardrobe.current.isFull('shirt')).toBe(true);
  expect(wardrobe.current.isFull('pants')).toBe(false);

  await expect(
    wardrobe.current.add({
      kind: 'shirt',
      variant: 'short-sleeve',
      mode: 'print',
      color: '#fff',
      align: {sx: 1, sy: 1, ox: 0, oy: 0},
      photoBase64: 'cGhvdG8=',
      thumbBase64: 'dGh1bWI=',
    }),
  ).rejects.toThrow('20');
  expect(storage.saveGarmentFiles).toHaveBeenCalledTimes(MAX_PER_KIND);

  await addMany(wardrobe, 'pants', MAX_PER_KIND);
  expect(wardrobe.current.counts).toEqual({
    shirt: MAX_PER_KIND,
    pants: MAX_PER_KIND,
  });
});

test('removing a garment frees a slot and deletes its photo', async () => {
  const wardrobe = await renderWardrobe();
  await addMany(wardrobe, 'pants', MAX_PER_KIND);
  expect(wardrobe.current.isFull('pants')).toBe(true);

  const [garment] = wardrobe.current.garments;
  await ReactTestRenderer.act(async () => {
    wardrobe.current.remove(garment);
  });

  expect(storage.deleteGarmentFiles).toHaveBeenCalledWith(garment);
  expect(wardrobe.current.isFull('pants')).toBe(false);
  expect(storage.saveGarments).toHaveBeenLastCalledWith(
    expect.not.arrayContaining([garment]),
  );
});
