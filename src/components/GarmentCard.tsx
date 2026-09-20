import React from 'react';
import {Image, Pressable, StyleSheet} from 'react-native';
import {theme, VARIANT_LABELS} from '../constants';
import {fileUri} from '../storage/wardrobeStorage';
import type {Garment} from '../types';

interface Props {
  garment: Garment;
  /** Width in points; the card is 4:5, like the 3D snapshot inside it. */
  width: number;
  onPress: (garment: Garment) => void;
}

/** A bordered box with the garment's 3D snapshot in it, and nothing else. */
export function GarmentCard({garment, width, onPress}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${VARIANT_LABELS[garment.variant]} in 3D`}
      onPress={() => onPress(garment)}
      style={({pressed}) => [styles.card, {width}, pressed && styles.pressed]}>
      <Image
        source={{uri: fileUri(garment.thumbFile)}}
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        style={styles.image}
      />
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
  pressed: {opacity: 0.8},
  image: {width: '100%', height: '100%'},
});
