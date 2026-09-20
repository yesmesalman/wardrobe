/**
 * @format
 */

import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {
  OutfitSwipeZone,
  stepIndex,
  SWIPE_DISTANCE,
} from '../src/components/OutfitSwipeZone';

describe('stepIndex', () => {
  test('a swipe left goes to the next item, a swipe right to the previous', () => {
    expect(stepIndex(1, -SWIPE_DISTANCE, 5)).toBe(2);
    expect(stepIndex(1, SWIPE_DISTANCE, 5)).toBe(0);
  });

  test('stops at the first and last item instead of looping', () => {
    expect(stepIndex(0, SWIPE_DISTANCE * 2, 5)).toBe(0);
    expect(stepIndex(4, -SWIPE_DISTANCE * 2, 5)).toBe(4);
  });

  test('ignores short drags', () => {
    expect(stepIndex(2, SWIPE_DISTANCE - 1, 5)).toBe(2);
    expect(stepIndex(2, -(SWIPE_DISTANCE - 1), 5)).toBe(2);
  });
});

const text = (renderer: ReactTestRenderer.ReactTestRenderer) =>
  renderer.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''))
    .join('|');

const render = async (element: React.ReactElement) => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(element);
  });
  return renderer;
};

describe('OutfitSwipeZone', () => {
  test('shows which item is on screen when there are several', async () => {
    const renderer = await render(
      <OutfitSwipeZone
        kind="shirt"
        count={6}
        index={1}
        onIndexChange={jest.fn()}
        onOpen={jest.fn()}
        onAdd={jest.fn()}
      />,
    );
    expect(text(renderer)).toContain('2 / 6');
  });

  test('has no badge when there is only one item', async () => {
    const renderer = await render(
      <OutfitSwipeZone
        kind="pants"
        count={1}
        index={0}
        onIndexChange={jest.fn()}
        onOpen={jest.fn()}
        onAdd={jest.fn()}
      />,
    );
    expect(text(renderer)).toBe('');
  });

  test('opens the garment when tapped', async () => {
    const onOpen = jest.fn();
    const renderer = await render(
      <OutfitSwipeZone
        kind="shirt"
        count={2}
        index={0}
        onIndexChange={jest.fn()}
        onOpen={onOpen}
        onAdd={jest.fn()}
      />,
    );
    await ReactTestRenderer.act(async () => {
      renderer.root
        .find(node => node.props.accessibilityLabel === 'Open shirt')
        .props.onPress();
    });
    expect(onOpen).toHaveBeenCalled();
  });

  test('shows a placeholder that starts the add flow when there are none', async () => {
    const onAdd = jest.fn();
    const renderer = await render(
      <OutfitSwipeZone
        kind="pants"
        count={0}
        index={0}
        onIndexChange={jest.fn()}
        onOpen={jest.fn()}
        onAdd={onAdd}
      />,
    );
    expect(text(renderer)).toContain('Add pants');
    await ReactTestRenderer.act(async () => {
      renderer.root
        .find(node => node.props.accessibilityLabel === 'Add pants')
        .props.onPress();
    });
    expect(onAdd).toHaveBeenCalled();
  });
});
