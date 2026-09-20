/**
 * @format
 */

import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {ZOOM_STEP, ZoomControl} from '../src/components/ZoomControl';

/** The pressable with this accessibility label (not the view it renders). */
const findButton = (
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPressIn === 'function',
  )[0];

const press = async (
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) => {
  const button = findButton(renderer, label);
  await ReactTestRenderer.act(async () => {
    button.props.onPressIn();
    button.props.onPressOut();
  });
};

test('shows the zoom and zooms in and out by a step', async () => {
  const onZoom = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ZoomControl percent={125} onZoom={onZoom} />,
    );
  });
  const text = renderer.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''))
    .join('|');
  expect(text).toContain('125%');

  await press(renderer, 'Zoom in');
  expect(onZoom).toHaveBeenLastCalledWith(ZOOM_STEP);

  await press(renderer, 'Zoom out');
  expect(onZoom).toHaveBeenLastCalledWith(1 / ZOOM_STEP);
});

test('keeps zooming while a button is held, and stops when released', async () => {
  jest.useFakeTimers();
  const onZoom = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ZoomControl percent={100} onZoom={onZoom} />,
    );
  });
  const button = findButton(renderer, 'Zoom in');

  await ReactTestRenderer.act(async () => {
    button.props.onPressIn();
  });
  expect(onZoom).toHaveBeenCalledTimes(1);

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(350);
  });
  expect(onZoom.mock.calls.length).toBeGreaterThan(2);

  await ReactTestRenderer.act(async () => {
    button.props.onPressOut();
  });
  const calls = onZoom.mock.calls.length;
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(onZoom.mock.calls.length).toBe(calls);
  jest.useRealTimers();
});
