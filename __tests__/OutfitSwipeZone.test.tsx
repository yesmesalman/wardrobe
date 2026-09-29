/**
 * @format
 */

import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {
  dragOffset,
  FLICK_SPEED,
  OutfitSwipeZone,
  stepIndex,
  SWIPE_DISTANCE,
} from '../src/components/OutfitSwipeZone';

jest.mock('../src/storage/wardrobeStorage', () => ({
  fileUri: (name: string) => `file:///${name}`,
}));

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

  test('a short but quick flick still changes the item', () => {
    expect(stepIndex(2, -20, 5, -FLICK_SPEED)).toBe(3);
    expect(stepIndex(2, 20, 5, FLICK_SPEED)).toBe(1);
  });

  test('a flick back against the drag does not count', () => {
    expect(stepIndex(2, -20, 5, FLICK_SPEED)).toBe(2);
  });
});

describe('dragOffset', () => {
  test('follows the finger when there is another item that way', () => {
    expect(dragOffset(1, -80, 5, 390)).toBe(-80);
    expect(dragOffset(1, 80, 5, 390)).toBe(80);
  });

  test('resists past the first and last item, never beyond a third of the width', () => {
    const pulled = dragOffset(0, 80, 5, 390);
    expect(pulled).toBeGreaterThan(0);
    expect(pulled).toBeLessThan(80);
    expect(dragOffset(4, -1000, 5, 390)).toBeGreaterThan(-130);
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
  test('shows no text or count when there is only one item', async () => {
    const renderer = await render(
      <OutfitSwipeZone
        kind="pants"
        count={1}
        index={0}
        onIndexChange={jest.fn()}
        onAdd={jest.fn()}
      />,
    );
    expect(text(renderer)).toBe('');
  });

  test('shows no placeholder while the wardrobe is still loading', async () => {
    const renderer = await render(
      <OutfitSwipeZone
        kind="pants"
        loaded={false}
        count={0}
        index={0}
        onIndexChange={jest.fn()}
        onAdd={jest.fn()}
      />,
    );
    expect(text(renderer)).toBe('');
  });

  test('shows a placeholder that starts the add flow when there are none', async () => {
    const onAdd = jest.fn();
    const renderer = await render(
      <OutfitSwipeZone
        kind="pants"
        count={0}
        index={0}
        onIndexChange={jest.fn()}
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
