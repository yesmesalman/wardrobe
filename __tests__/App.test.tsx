/**
 * @format
 */

import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
// The WebView, the file system and the pickers need a native runtime.
jest.mock('../src/components/GarmentView', () => ({GarmentView: () => null}));
jest.mock('../src/storage/wardrobeStorage', () => ({
  loadGarments: jest.fn(() => Promise.resolve([])),
  saveGarments: jest.fn(() => Promise.resolve()),
  saveGarmentFiles: jest.fn(),
  readFileBase64: jest.fn(),
  deleteGarmentFiles: jest.fn(),
  fileUri: jest.fn((name: string) => `file:///garments/${name}`),
}));
jest.mock('../src/hooks/pickPhoto', () => ({pickPhoto: jest.fn()}));

// A cold Babel cache transpiles the whole app tree, which can exceed 5 seconds.
jest.setTimeout(30000);

test('renders an empty library', async () => {
  jest.useFakeTimers();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await ReactTestRenderer.act(async () => {
    jest.runOnlyPendingTimers();
  });
  const text = renderer.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''))
    .join('|');
  jest.useRealTimers();
  expect(text).toContain('Shirts 0/20');
  expect(text).toContain('Pants 0/20');
  expect(text).toContain('No shirts yet');
});
