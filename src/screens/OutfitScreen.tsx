import React, {useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GarmentViewerModal} from '../components/GarmentViewerModal';
import {OutfitScene} from '../components/OutfitScene';
import {OutfitSwipeZone} from '../components/OutfitSwipeZone';
import {ScreenHeader} from '../components/ScreenHeader';
import {theme} from '../constants';
import {useWardrobeContext} from '../state/WardrobeContext';
import type {Garment} from '../types';

/** Until the scene reports where the waist falls, assume roughly here. */
const DEFAULT_SPLIT = 0.5;

/**
 * The outfit, as if someone were wearing it: the shirt from the Library over
 * the pants from the Library, in one 3D view. Swipe the upper half to pick
 * another shirt and the lower half to pick other pants.
 */
export function OutfitScreen() {
  const insets = useSafeAreaInsets();
  const {
    wardrobe: {garments, remove},
    startAdd,
  } = useWardrobeContext();
  const [viewing, setViewing] = useState<Garment | null>(null);
  const [shirtIndex, setShirtIndex] = useState(0);
  const [pantsIndex, setPantsIndex] = useState(0);
  const [split, setSplit] = useState(DEFAULT_SPLIT);

  const shirts = useMemo(
    () => garments.filter(g => g.kind === 'shirt'),
    [garments],
  );
  const pants = useMemo(
    () => garments.filter(g => g.kind === 'pants'),
    [garments],
  );

  // A deleted item can leave the index past the end.
  const shirtAt = Math.min(shirtIndex, Math.max(shirts.length - 1, 0));
  const pantsAt = Math.min(pantsIndex, Math.max(pants.length - 1, 0));
  const shirt = shirts[shirtAt] ?? null;
  const trousers = pants[pantsAt] ?? null;

  const percent = (fraction: number) => `${(fraction * 100).toFixed(2)}%` as const;

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <ScreenHeader title="Outfit" subtitle="Swipe to mix and match" showAdd />
      <View style={styles.panel}>
        <OutfitScene
          shirt={shirt}
          pants={trousers}
          onSplitChange={setSplit}
          style={StyleSheet.absoluteFill}
        />
        <OutfitSwipeZone
          kind="shirt"
          count={shirts.length}
          index={shirtAt}
          onIndexChange={setShirtIndex}
          onOpen={() => shirt && setViewing(shirt)}
          onAdd={() => startAdd('shirt')}
          style={[styles.top, {height: percent(split)}]}
        />
        <OutfitSwipeZone
          kind="pants"
          count={pants.length}
          index={pantsAt}
          onIndexChange={setPantsIndex}
          onOpen={() => trousers && setViewing(trousers)}
          onAdd={() => startAdd('pants')}
          style={[styles.bottom, {top: percent(split)}]}
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
  top: {top: 0},
  bottom: {bottom: 0},
  root: {flex: 1, backgroundColor: theme.background},
  panel: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.sceneBottom,
    overflow: 'hidden',
  },
});
