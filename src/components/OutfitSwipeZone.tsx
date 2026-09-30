import React, {useMemo} from 'react';
import {
  PanResponder,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import {trigger} from 'react-native-haptic-feedback';
import {theme} from '../constants';
import type {GarmentKind} from '../types';
import {PantsIcon, ShirtIcon} from './icons';
import {OutfitArrow} from './OutfitArrow';

interface Props {
  kind: GarmentKind;
  /** False until the wardrobe has been read from storage. */
  loaded?: boolean;
  count: number;
  index: number;
  onIndexChange: (index: number) => void;
  /** While swiping: how far (in points) the garment should follow the finger. */
  onDrag?: (dx: number) => void;
  /** The finger lifted (or the swipe was cancelled); `changed` if it picked another item. */
  onDragEnd?: (changed: boolean) => void;
  /** Where the garment's middle falls in this zone (0 = top, 1 = bottom); the arrows sit there. */
  centre?: number;
  /** Tapped on the placeholder shown when there is nothing to pick from. */
  onAdd: () => void;
  style?: StyleProp<ViewStyle>;
}

/** A swipe further than this many points changes the item. */
export const SWIPE_DISTANCE = 45;
/** A shorter swipe still counts when the finger leaves this fast (points/ms). */
export const FLICK_SPEED = 0.3;

/** Which way a swipe goes: 1 to the next item, -1 to the previous, 0 neither. */
function swipeDirection(dx: number, vx: number): number {
  if (Math.abs(dx) >= SWIPE_DISTANCE) {
    return -Math.sign(dx);
  }
  // A quick flick, as long as the finger was still moving the same way.
  if (Math.abs(vx) >= FLICK_SPEED && Math.sign(vx) === Math.sign(dx)) {
    return -Math.sign(dx);
  }
  return 0;
}

/**
 * Where a horizontal swipe of `dx` points, released at `vx` points/ms, lands:
 * a swipe left moves to the next item, a swipe right to the previous one, and
 * it stops at the ends.
 */
export function stepIndex(
  index: number,
  dx: number,
  count: number,
  vx = 0,
): number {
  const next = index + swipeDirection(dx, vx);
  return Math.max(0, Math.min(next, count - 1));
}

/**
 * How far the garment follows a finger `dx` points out: all the way, unless
 * there is nothing more that way, when it gives less and less (like an iOS
 * scroll view pulled past its end) and never more than a third of `width`.
 */
export function dragOffset(
  index: number,
  dx: number,
  count: number,
  width: number,
): number {
  const atEnd = dx > 0 ? index <= 0 : index >= count - 1;
  if (!atEnd) {
    return dx;
  }
  const limit = width / 3;
  return Math.sign(dx) * limit * (1 - 1 / ((Math.abs(dx) * 0.55) / limit + 1));
}

const EMPTY_TITLE: Record<GarmentKind, string> = {
  shirt: 'Add a shirt',
  pants: 'Add pants',
};

/**
 * An invisible touch area over one garment of the outfit: swipe sideways (or
 * tap the ‹ › arrows at its edges) to pick another from the Library. It draws
 * only the arrows, or a dashed placeholder when there is nothing to show.
 */
export function OutfitSwipeZone({
  kind,
  loaded = true,
  count,
  index,
  onIndexChange,
  onDrag,
  onDragEnd,
  centre = 0.5,
  onAdd,
  style,
}: Props) {
  const {width} = useWindowDimensions();
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Only claim clearly horizontal drags, so taps still reach the button.
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        // Keep the swipe once it has started, even if it wanders vertically.
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) =>
          onDrag?.(dragOffset(index, g.dx, count, width)),
        onPanResponderRelease: (_, g) => {
          const target = stepIndex(index, g.dx, count, g.vx);
          onDragEnd?.(target !== index);
          if (target !== index) {
            onIndexChange(target);
          } else if (swipeDirection(g.dx, g.vx)) {
            // A real swipe towards an end with nothing more: bump.
            trigger('rigid');
          }
        },
        onPanResponderTerminate: () => onDragEnd?.(false),
      }),
    [index, count, width, onIndexChange, onDrag, onDragEnd],
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
      {/* With one item there is nowhere to go; at an end, that arrow fades. */}
      {count > 1 ? (
        <>
          <OutfitArrow
            kind={kind}
            side="left"
            enabled={index > 0}
            centre={centre}
            onPress={() => onIndexChange(index - 1)}
          />
          <OutfitArrow
            kind={kind}
            side="right"
            enabled={index < count - 1}
            centre={centre}
            onPress={() => onIndexChange(index + 1)}
          />
        </>
      ) : null}
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
