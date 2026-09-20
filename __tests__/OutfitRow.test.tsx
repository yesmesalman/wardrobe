/**
 * @format
 */

import React from 'react';
import {Image, Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {OutfitRow} from '../src/components/OutfitRow';
import type {Garment} from '../src/types';

jest.mock('../src/storage/wardrobeStorage', () => ({
  fileUri: jest.fn((name: string) => `file:///garments/${name}`),
}));

const garment = (id: string, kind: 'shirt' | 'pants'): Garment => ({
  id,
  kind,
  variant: kind === 'shirt' ? 'short-sleeve' : 'long-pants',
  mode: 'fit',
  photoFile: `${id}.jpg`,
  cutoutFile: `${id}-cutout.png`,
  thumbFile: `${id}-thumb.jpg`,
  color: '#fff',
  align: {sx: 1, sy: 1, ox: 0, oy: 0},
  createdAt: 1,
});

/** The row lays its list out only once it knows its size. */
async function layOut(renderer: ReactTestRenderer.ReactTestRenderer) {
  const panel = renderer.root.find(
    node => typeof node.props.onLayout === 'function',
  );
  await ReactTestRenderer.act(async () => {
    panel.props.onLayout({
      nativeEvent: {layout: {x: 0, y: 0, width: 300, height: 400}},
    });
  });
}

test('shows the first garment of its kind', async () => {
  const items = [garment('a', 'shirt'), garment('b', 'shirt')];
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <OutfitRow kind="shirt" items={items} onOpen={jest.fn()} onAdd={jest.fn()} />,
    );
  });
  await layOut(renderer);

  const uris = renderer.root
    .findAllByType(Image)
    .map(image => image.props.source.uri);
  expect(uris[0]).toBe('file:///garments/a-thumb.jpg');
  expect(uris).toContain('file:///garments/b-thumb.jpg');
});

test('opens a garment when it is tapped', async () => {
  const items = [garment('a', 'pants')];
  const onOpen = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <OutfitRow kind="pants" items={items} onOpen={onOpen} onAdd={jest.fn()} />,
    );
  });
  await layOut(renderer);

  const open = renderer.root.find(
    node => node.props.accessibilityLabel === 'Open Long pants in 3D',
  );
  await ReactTestRenderer.act(async () => {
    open.props.onPress();
  });
  expect(onOpen).toHaveBeenCalledWith(items[0]);
});

test('shows a placeholder that starts the add flow when there are none', async () => {
  const onAdd = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <OutfitRow kind="shirt" items={[]} onOpen={jest.fn()} onAdd={onAdd} />,
    );
  });
  const text = renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .join('|');
  expect(text).toContain('Add a shirt');

  await ReactTestRenderer.act(async () => {
    renderer.root
      .find(node => node.props.accessibilityLabel === 'Add a shirt')
      .props.onPress();
  });
  expect(onAdd).toHaveBeenCalled();
});
