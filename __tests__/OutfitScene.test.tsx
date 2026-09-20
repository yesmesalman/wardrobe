/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {OutfitScene} from '../src/components/OutfitScene';
import type {Garment} from '../src/types';

const mockInject = jest.fn();
let mockOnMessage: ((event: {nativeEvent: {data: string}}) => void) | undefined;

jest.mock('react-native-webview', () => {
  const ReactMock = require('react');
  return {
    WebView: ReactMock.forwardRef((props: any, ref: any) => {
      mockOnMessage = props.onMessage;
      ReactMock.useImperativeHandle(ref, () => ({
        injectJavaScript: mockInject,
      }));
      return null;
    }),
  };
});
jest.mock('../src/storage/wardrobeStorage', () => ({
  readFileBase64: jest.fn(() => Promise.resolve('aW1hZ2U=')),
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

const flush = () =>
  ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

/** The outfit the page was last told to show. */
const lastOutfit = () => {
  const calls = mockInject.mock.calls
    .map(([code]) => code as string)
    .filter(code => code.startsWith('window.__setOutfit('));
  const code = calls[calls.length - 1];
  return JSON.parse(code.slice('window.__setOutfit('.length, code.indexOf(');true;')));
};

test('tells the page which way a new garment slides in from', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const render = async (shirt: Garment, slide: number) => {
    await ReactTestRenderer.act(async () => {
      const element = (
        <OutfitScene shirt={shirt} pants={null} shirtSlide={slide} />
      );
      if (renderer) {
        renderer.update(element);
      } else {
        renderer = ReactTestRenderer.create(element);
      }
    });
    await flush();
  };

  await render(garment('a', 'shirt'), 0);
  await ReactTestRenderer.act(async () => {
    mockOnMessage?.({nativeEvent: {data: JSON.stringify({type: 'ready'})}});
  });
  await flush();
  expect(lastOutfit().shirt).toMatchObject({id: 'a', slide: 0});
  expect(lastOutfit().pants).toBeNull();

  // Swiping to the next shirt: it comes in from the right.
  await render(garment('b', 'shirt'), 1);
  expect(lastOutfit().shirt).toMatchObject({id: 'b', slide: 1});

  // Back to the previous one: from the left.
  await render(garment('a', 'shirt'), -1);
  expect(lastOutfit().shirt).toMatchObject({id: 'a', slide: -1});
});
