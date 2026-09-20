/**
 * @format
 */

import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import {SettingsScreen} from '../src/screens/SettingsScreen';

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
jest.setTimeout(60000);

const screenText = (renderer: ReactTestRenderer.ReactTestRenderer) =>
  renderer.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''))
    .join('|');

const settle = async () => {
  await ReactTestRenderer.act(async () => {
    jest.runOnlyPendingTimers();
  });
};

async function openTab(
  renderer: ReactTestRenderer.ReactTestRenderer,
  name: string,
) {
  const tab = renderer.root.find(
    node =>
      typeof node.props.accessibilityLabel === 'string' &&
      node.props.accessibilityLabel.startsWith(`${name},`) &&
      typeof node.props.onPress === 'function',
  );
  await ReactTestRenderer.act(async () => {
    tab.props.onPress({});
  });
  await settle();
}

test('has Outfit, Library and Settings tabs, with Add item on Outfit and Library', async () => {
  jest.useFakeTimers();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await settle();

  // Library is the starting tab.
  let text = screenText(renderer);
  expect(text).toContain('Outfit');
  expect(text).toContain('Library');
  expect(text).toContain('Settings');
  expect(text).toContain('Shirts 0/20');
  expect(text).toContain('Pants 0/20');
  expect(text).toContain('No shirts yet');
  expect(text).toContain('Add item');
  // Tab bar order: Outfit sits in the centre.
  expect(text.endsWith('Library|Outfit|Settings')).toBe(true);

  await openTab(renderer, 'Outfit');
  text = screenText(renderer);
  expect(text).toContain('Swipe to mix and match');
  // Nothing in the Library yet, so both rows are placeholders.
  expect(text).toContain('Add a shirt');
  expect(text).toContain('Add pants');
  expect(text).toContain('Add item');

  jest.useRealTimers();
});

test('Settings is empty and has no Add item button', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<SettingsScreen />);
  });
  const text = screenText(renderer);
  expect(text).toContain('Settings');
  expect(text).not.toContain('Add item');
});
