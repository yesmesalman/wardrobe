import React from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import {theme, VARIANT_LABELS} from '../constants';
import {fileUri} from '../storage/wardrobeStorage';
import type {Garment} from '../types';
import {CheckIcon} from './icons';

interface Props {
  garment: Garment;
  /** Width in points; the card is 4:5, like the 3D snapshot inside it. */
  width: number;
  onPress: (garment: Garment) => void;
  /** The Library is picking items: show a circle to tick at the top right. */
  selecting?: boolean;
  selected?: boolean;
}

/** A bordered box with the garment's 3D snapshot in it, and nothing else. */
export function GarmentCard({
  garment,
  width,
  onPress,
  selecting = false,
  selected = false,
}: Props) {
  const label = VARIANT_LABELS[garment.variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={selecting ? label : `Open ${label} in 3D`}
      accessibilityState={selecting ? {selected} : undefined}
      onPress={() => onPress(garment)}
      style={({pressed}) => [
        styles.card,
        {width},
        selected && styles.selected,
        pressed && styles.pressed,
      ]}>
      <Image
        source={{uri: fileUri(garment.thumbFile)}}
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        style={styles.image}
      />
      {selecting ? (
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected ? (
            <CheckIcon size={14} color={theme.accentText} strokeWidth={2.6} />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 0.8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.sceneBottom,
    overflow: 'hidden',
  },
  selected: {borderColor: theme.accent},
  pressed: {opacity: 0.8},
  image: {width: '100%', height: '100%'},
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {backgroundColor: theme.accent},
});
