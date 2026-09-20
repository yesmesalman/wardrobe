import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {theme, VARIANT_LABELS} from '../constants';
import {fileUri} from '../storage/wardrobeStorage';
import type {Garment} from '../types';

interface Props {
  garment: Garment;
  onPress: (garment: Garment) => void;
}

export function GarmentCard({garment, onPress}: Props) {
  const label = VARIANT_LABELS[garment.variant];
  const added = new Date(garment.createdAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${label} in 3D`}
      onPress={() => onPress(garment)}
      style={({pressed}) => [styles.card, pressed && styles.pressed]}>
      <Image
        source={{uri: fileUri(garment.thumbFile)}}
        accessibilityIgnoresInvertColors
        style={styles.scene}
      />
      <View style={styles.footer}>
        <View>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.date}>{added}</Text>
        </View>
        <View style={[styles.dot, {backgroundColor: garment.color}]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  pressed: {opacity: 0.85},
  scene: {width: '100%', aspectRatio: 0.8, backgroundColor: theme.sceneBottom},
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {fontSize: 15, fontWeight: '600', color: theme.ink},
  date: {fontSize: 12, color: theme.muted, marginTop: 2},
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.muted,
  },
});
