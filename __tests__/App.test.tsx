/**
 * @format
 */

import React from 'react';
import {Alert, Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import {SettingsScreen} from '../src/screens/SettingsScreen';
import {WardrobeProvider} from '../src/state/WardrobeContext';
import * as settingsStorage from '../src/storage/settingsStorage';
import * as wardrobeStorage from '../src/storage/wardrobeStorage';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
// The WebView, the file system and the pickers need a native runtime.
jest.mock('../src/components/GarmentView', () => ({GarmentView: () => null}));
jest.mock('../src/components/OutfitScene', () => ({OutfitScene: () => null}));
jest.mock('../src/storage/wardrobeStorage', () => ({
  loadGarments: jest.fn(() => Promise.resolve([])),
  saveGarments: jest.fn(() => Promise.resolve()),
  saveGarmentFiles: jest.fn(),
  readFileBase64: jest.fn(),
  takeTempFileBase64: jest.fn(),
  deleteGarmentFiles: jest.fn(),
  deleteAllData: jest.fn(() => Promise.resolve()),
  fileUri: jest.fn((name: string) => `file:///garments/${name}`),
}));
jest.mock('../src/storage/settingsStorage', () => ({
  loadSettings: jest.fn(() => Promise.resolve({bodyType: 'man'})),
  saveSettings: jest.fn(() => Promise.resolve()),
}));
jest.mock('../src/hooks/pickPhoto', () => ({pickPhoto: jest.fn()}));
// The background-removal model runs natively.
jest.mock('../src/ai/garmentMask', () => ({
  garmentMask: jest.fn(() => Promise.resolve(null)),
  prepareGarmentMask: jest.fn(),
}));

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

const hasAddButton = (renderer: ReactTestRenderer.ReactTestRenderer) =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Add item' &&
      typeof node.props.onPress === 'function',
  ).length > 0;

test('has Library, Outfit, Trending and Settings tabs, with a centre Add item button', async () => {
  jest.useFakeTimers();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await settle();

  // Library is the starting tab.
  let text = screenText(renderer);
  expect(text).toContain('Your wardrobe');
  expect(text).toContain('Shirts');
  expect(text).toContain('Pants');
  expect(text).toContain('No shirts yet');
  // Tab bar order; the round Add item button sits between Outfit and Trending.
  expect(text.endsWith('Library|Outfit|Trending|Settings')).toBe(true);
  expect(hasAddButton(renderer)).toBe(true);

  await openTab(renderer, 'Outfit');
  text = screenText(renderer);
  expect(text).toContain('Mix and match your wardrobe');
  // Nothing in the Library yet, so both rows are placeholders.
  expect(text).toContain('Add a shirt');
  expect(text).toContain('Add pants');

  jest.useRealTimers();
});

test('Settings has Avatar Settings, Reset Data and no Add item button', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <WardrobeProvider>
        <SettingsScreen />
      </WardrobeProvider>,
    );
  });
  const text = screenText(renderer);
  expect(text).toContain('Settings');
  expect(text).toContain('Avatar Settings');
  expect(text).toContain('Reset Data');
  expect(text).not.toContain('Add item');
});

test('Avatar Settings changes the body type, Man by default, after confirming it removes all data', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <WardrobeProvider>
        <SettingsScreen />
      </WardrobeProvider>,
    );
  });
  const pressable = (label: string, extra = {}) =>
    renderer.root.find(
      node =>
        typeof node.props.onPress === 'function' &&
        node.findAllByType(Text).some(t => t.props.children === label) &&
        Object.entries(extra).every(([k, v]) => node.props[k] === v),
    );
  await ReactTestRenderer.act(async () => {
    pressable('Avatar Settings').props.onPress();
  });
  expect(screenText(renderer)).toContain('Body Type');
  const segment = (label: string) =>
    pressable(label, {accessibilityRole: 'button'}).props.accessibilityState
      .selected;
  expect(segment('Man')).toBe(true);
  expect(segment('Woman')).toBe(false);

  // Asks first; cancelling keeps everything.
  await ReactTestRenderer.act(async () => {
    pressable('Woman', {accessibilityRole: 'button'}).props.onPress();
  });
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert.mock.calls[0][1]).toContain('remove all your data');
  const buttons = alert.mock.calls[0][2]!;
  await ReactTestRenderer.act(async () => {
    buttons.find(b => b.style === 'cancel')?.onPress?.();
  });
  expect(segment('Man')).toBe(true);
  expect(wardrobeStorage.deleteAllData).not.toHaveBeenCalled();
  expect(settingsStorage.saveSettings).not.toHaveBeenCalled();

  // Confirming removes all data, then changes the body type.
  await ReactTestRenderer.act(async () => {
    await buttons.find(b => b.style === 'destructive')?.onPress?.();
  });
  expect(wardrobeStorage.deleteAllData).toHaveBeenCalled();
  expect(segment('Woman')).toBe(true);
  expect(settingsStorage.saveSettings).toHaveBeenCalledWith({bodyType: 'woman'});
  alert.mockRestore();
});
