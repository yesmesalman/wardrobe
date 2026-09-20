import React, {useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GarmentViewerModal} from '../components/GarmentViewerModal';
import {OutfitRow} from '../components/OutfitRow';
import {ScreenHeader} from '../components/ScreenHeader';
import {theme} from '../constants';
import {useWardrobeContext} from '../state/WardrobeContext';
import type {Garment} from '../types';

/**
 * The outfit: the first shirt from the Library with the first pants right
 * below it. Swipe either one sideways to pick another from the Library.
 */
export function OutfitScreen() {
  const insets = useSafeAreaInsets();
  const {
    wardrobe: {garments, remove},
    startAdd,
  } = useWardrobeContext();
  const [viewing, setViewing] = useState<Garment | null>(null);

  const shirts = useMemo(
    () => garments.filter(g => g.kind === 'shirt'),
    [garments],
  );
  const pants = useMemo(
    () => garments.filter(g => g.kind === 'pants'),
    [garments],
  );

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <ScreenHeader
        title="Outfit"
        subtitle="Swipe to mix and match"
        showAdd
      />
      <View style={styles.body}>
        <OutfitRow
          kind="shirt"
          items={shirts}
          onOpen={setViewing}
          onAdd={() => startAdd('shirt')}
        />
        <OutfitRow
          kind="pants"
          items={pants}
          onOpen={setViewing}
          onAdd={() => startAdd('pants')}
        />
      </View>
      <GarmentViewerModal
        garment={viewing}
        onClose={() => setViewing(null)}
        onDelete={remove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.background},
  body: {flex: 1, paddingHorizontal: 16, paddingBottom: 16, gap: 12},
});
