import React, {useMemo} from 'react';
import {
  PanResponder,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {theme} from '../constants';
import type {GarmentKind} from '../types';
import {PantsIcon, ShirtIcon} from './icons';

interface Props {
  kind: GarmentKind;
  count: number;
  index: number;
  onIndexChange: (index: number) => void;
  /** Tapped while an item is showing. */
  onOpen: () => void;
  /** Tapped on the placeholder shown when there is nothing to pick from. */
  onAdd: () => void;
  style?: StyleProp<ViewStyle>;
}

/** A swipe further than this many points changes the item. */
export const SWIPE_DISTANCE = 45;

/**
 * Where a horizontal swipe of `dx` points lands: a swipe left moves to the
 * next item, a swipe right to the previous one, and it stops at the ends.
 */
export function stepIndex(index: number, dx: number, count: number): number {
  if (dx <= -SWIPE_DISTANCE) {
    return Math.min(index + 1, count - 1);
  }
  if (dx >= SWIPE_DISTANCE) {
    return Math.max(index - 1, 0);
  }
  return index;
}

const EMPTY_TITLE: Record<GarmentKind, string> = {
  shirt: 'Add a shirt',
  pants: 'Add pants',
};

/**
 * An invisible touch area over one garment of the outfit: swipe sideways to
 * pick another from the Library, tap to open it. It draws only a small
 * position badge, or a dashed placeholder when there is nothing to show.
 */
export function OutfitSwipeZone({
  kind,
  count,
  index,
  onIndexChange,
  onOpen,
  onAdd,
  style,
}: Props) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Only claim clearly horizontal drags, so taps still reach the button.
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) =>
          onIndexChange(stepIndex(index, g.dx, count)),
      }),
    [index, count, onIndexChange],
  );

  if (count === 0) {
    const Icon = kind === 'shirt' ? ShirtIcon : PantsIcon;
    return (
      <View style={[styles.zone, style]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={EMPTY_TITLE[kind]}
          onPress={onAdd}
          style={styles.empty}>
          <Icon size={44} color={theme.muted} strokeWidth={1.3} />
          <Text style={styles.emptyTitle}>{EMPTY_TITLE[kind]}</Text>
          <Text style={styles.emptyHint}>Tap to photograph one</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.zone, style]} {...panResponder.panHandlers}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${kind}`}
        onPress={onOpen}
        style={StyleSheet.absoluteFill}
      />
      {count > 1 ? (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>
            {index > 0 ? '‹ ' : '  '}
            {index + 1} / {count}
            {index < count - 1 ? ' ›' : '  '}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {position: 'absolute', left: 0, right: 0},
  badge: {
    position: 'absolute',
    top: 10,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(28,27,26,0.55)',
  },
  badgeText: {color: '#fff', fontSize: 12, fontWeight: '700'},
  empty: {
    alignSelf: 'center',
    marginTop: 24,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 34,
    paddingVertical: 22,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.muted,
  },
  emptyTitle: {fontSize: 16, fontWeight: '700', color: theme.ink, marginTop: 4},
  emptyHint: {fontSize: 12, color: theme.muted},
});
