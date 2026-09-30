import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {KIND_LABELS, theme} from '../constants';
import type {GarmentKind} from '../types';
import {ChevronIcon} from './icons';

const SIZE = 48;
const HEIGHT = 64;

interface Props {
  kind: GarmentKind;
  side: 'left' | 'right';
  /** False when there is nothing more that way: the arrow fades and does nothing. */
  enabled: boolean;
  /** Height of the arrow's middle, as a fraction of its zone (0 = top). */
  centre: number;
  onPress: () => void;
}

/**
 * A large, faded grey ‹ or › at the screen edge beside one garment of the
 * outfit: tap it for the previous or next item.
 */
export function OutfitArrow({kind, side, enabled, centre, onPress}: Props) {
  const what = KIND_LABELS[kind].singular.toLowerCase();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${side === 'left' ? 'Previous' : 'Next'} ${what}`}
      disabled={!enabled}
      onPress={onPress}
      hitSlop={8}
      style={({pressed}) => [
        styles.arrow,
        side === 'left' ? styles.left : styles.right,
        {top: `${(centre * 100).toFixed(2)}%`},
        !enabled && styles.faded,
        pressed && styles.pressed,
      ]}>
      <View style={side === 'left' ? styles.flip : undefined}>
        <ChevronIcon size={SIZE} color={theme.muted} strokeWidth={1.3} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Faded, so it stays quieter than the garments.
  arrow: {
    position: 'absolute',
    marginTop: -HEIGHT / 2,
    width: SIZE,
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.45,
  },
  left: {left: 0},
  right: {right: 0},
  // The chevron is drawn pointing right.
  flip: {transform: [{scaleX: -1}]},
  // Nothing more that way: disabled, a little fainter but still visible.
  faded: {opacity: 0.25},
  // Darkens while held.
  pressed: {opacity: 0.8},
});
