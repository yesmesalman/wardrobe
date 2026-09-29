import React, {useEffect, useRef} from 'react';
import {Animated, Image, Pressable, StyleSheet} from 'react-native';
import {VARIANT_LABELS} from '../constants';
import {fileUri} from '../storage/wardrobeStorage';
import type {Garment} from '../types';

const WIDTH = 52;
const HEIGHT = 64;
const EDGE = 4;

interface Props {
  garment: Garment;
  side: 'left' | 'right';
  /** 1 = next to the current item, 2 = the one beyond it. */
  distance: 1 | 2;
  /** Height of the peek's middle, as a fraction of its zone (0 = top). */
  centre: number;
  onPress: () => void;
}

/**
 * The garment cut-out of a nearby item, unframed, in a shallow arc beside the
 * figure: the further from the current item, the smaller, lower and fainter.
 * It glides between positions as the current item changes.
 */
export function NeighbourPeek({garment, side, distance, centre, onPress}: Props) {
  const depth = useRef(new Animated.Value(distance)).current;
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(depth, {
      toValue: distance,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [depth, distance]);
  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [appear]);

  const sign = side === 'left' ? 1 : -1;
  const range = [1, 2];
  const scale = depth.interpolate({inputRange: range, outputRange: [1, 0.7]});
  const shift = depth.interpolate({
    inputRange: range,
    outputRange: [sign * (WIDTH - 8), sign * -EDGE],
  });
  const drop = depth.interpolate({inputRange: range, outputRange: [0, 16]});
  const tilt = depth.interpolate({
    inputRange: range,
    outputRange: ['0deg', `${-sign * 9}deg`],
  });
  const fade = depth.interpolate({inputRange: range, outputRange: [0.85, 0.5]});

  return (
    <Animated.View
      style={[
        styles.peek,
        side === 'left' ? styles.left : styles.right,
        {top: `${(centre * 100).toFixed(2)}%`},
        {
          opacity: Animated.multiply(fade, appear),
          transform: [
            {translateX: shift},
            {translateY: drop},
            {rotate: tilt},
            {scale},
          ],
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Show ${side === 'left' ? 'previous' : 'next'} ${
          VARIANT_LABELS[garment.variant]
        }`}
        onPress={onPress}
        hitSlop={8}
        style={styles.fill}>
        <Image
          source={{uri: fileUri(garment.cutoutFile ?? garment.thumbFile)}}
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          style={styles.fill}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  peek: {
    position: 'absolute',
    marginTop: -HEIGHT / 2,
    width: WIDTH,
    height: HEIGHT,
  },
  left: {left: EDGE},
  right: {right: EDGE},
  fill: {width: '100%', height: '100%'},
});
