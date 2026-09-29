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
import type {Garment, GarmentKind} from '../types';
import {PantsIcon, ShirtIcon} from './icons';
import {NeighbourPeek} from './NeighbourPeek';

interface Props {
  kind: GarmentKind;
  /** False until the wardrobe has been read from storage. */
  loaded?: boolean;
  count: number;
  index: number;
  onIndexChange: (index: number) => void;
  /** Up to two items before and after the current one, nearest first. */
  previous?: Garment[];
  next?: Garment[];
  /** Where the garment's middle falls in this zone (0 = top, 1 = bottom). */
  centre?: number;
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
 * pick another from the Library. It draws only small previews of the
 * neighbouring items, or a dashed placeholder when there is nothing to show.
 */
export function OutfitSwipeZone({
  kind,
  loaded = true,
  count,
  index,
  onIndexChange,
  previous,
  next,
  centre = 0.5,
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

  // Until storage has been read the wardrobe only looks empty; show nothing.
  if (!loaded) {
    return <View style={[styles.zone, style]} pointerEvents="none" />;
  }

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
      {previous?.map((g, i) => (
        <NeighbourPeek
          key={g.id}
          garment={g}
          side="left"
          distance={(i + 1) as 1 | 2}
          centre={centre}
          onPress={() => onIndexChange(index - (i + 1))}
        />
      ))}
      {next?.map((g, i) => (
        <NeighbourPeek
          key={g.id}
          garment={g}
          side="right"
          distance={(i + 1) as 1 | 2}
          centre={centre}
          onPress={() => onIndexChange(index + (i + 1))}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {position: 'absolute', left: 0, right: 0},
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
