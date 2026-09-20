import React, {useEffect, useRef, useState} from 'react';
import {
  FlatList,
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {theme, VARIANT_LABELS} from '../constants';
import {fileUri} from '../storage/wardrobeStorage';
import type {Garment, GarmentKind} from '../types';
import {PantsIcon, ShirtIcon} from './icons';

interface Props {
  kind: GarmentKind;
  /** Garments of this kind, in Library order; the first one is shown first. */
  items: Garment[];
  onOpen: (garment: Garment) => void;
  /** Called from the placeholder shown when there is nothing to pick from. */
  onAdd: () => void;
}

const EMPTY_TITLE: Record<GarmentKind, string> = {
  shirt: 'Add a shirt',
  pants: 'Add pants',
};

/**
 * One row of the outfit: a panel showing one garment's 3D snapshot, which
 * swipes sideways through the other garments of the same kind.
 */
export function OutfitRow({kind, items, onOpen, onAdd}: Props) {
  const list = useRef<FlatList<Garment>>(null);
  const [size, setSize] = useState<{width: number; height: number} | null>(
    null,
  );
  const [index, setIndex] = useState(0);

  // If the item on screen was deleted, fall back to the last one.
  useEffect(() => {
    if (size && items.length > 0 && index > items.length - 1) {
      const last = items.length - 1;
      setIndex(last);
      list.current?.scrollToOffset({offset: last * size.width, animated: false});
    }
  }, [items.length, index, size]);

  if (items.length === 0) {
    const Icon = kind === 'shirt' ? ShirtIcon : PantsIcon;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={EMPTY_TITLE[kind]}
        onPress={onAdd}
        style={[styles.panel, styles.empty]}>
        <Icon size={52} color={theme.muted} strokeWidth={1.3} />
        <Text style={styles.emptyTitle}>{EMPTY_TITLE[kind]}</Text>
        <Text style={styles.emptyHint}>Tap to photograph one</Text>
      </Pressable>
    );
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    setSize({width, height});
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (size) {
      setIndex(Math.round(e.nativeEvent.contentOffset.x / size.width));
    }
  };

  return (
    <View style={styles.panel} onLayout={onLayout}>
      {size ? (
        <FlatList
          ref={list}
          data={items}
          keyExtractor={g => g.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          getItemLayout={(_, i) => ({
            length: size.width,
            offset: size.width * i,
            index: i,
          })}
          renderItem={({item}) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${VARIANT_LABELS[item.variant]} in 3D`}
              onPress={() => onOpen(item)}
              style={{width: size.width, height: size.height}}>
              <Image
                source={{uri: fileUri(item.thumbFile)}}
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                style={styles.image}
              />
            </Pressable>
          )}
        />
      ) : null}
      {items.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {items.map((g, i) => (
            <View
              key={g.id}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.sceneBottom,
    overflow: 'hidden',
  },
  image: {width: '100%', height: '100%'},
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.cardBorder,
  },
  dotActive: {backgroundColor: theme.accent},
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderStyle: 'dashed',
    borderColor: theme.muted,
    backgroundColor: 'transparent',
  },
  emptyTitle: {fontSize: 17, fontWeight: '700', color: theme.ink, marginTop: 4},
  emptyHint: {fontSize: 13, color: theme.muted},
});
