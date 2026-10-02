import React, {useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {trigger} from 'react-native-haptic-feedback';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  OutfitScene,
  type OutfitLayout,
  type OutfitSceneHandle,
} from '../components/OutfitScene';
import {OutfitSwipeZone} from '../components/OutfitSwipeZone';
import {ScreenHeader} from '../components/ScreenHeader';
import {theme} from '../constants';
import {useWardrobeContext} from '../state/WardrobeContext';

/** Until the scene reports where the waist falls, assume roughly here. */
const DEFAULT_LAYOUT: OutfitLayout = {
  split: 0.5,
  shirtCentre: 0.28,
  pantsCentre: 0.75,
};

/**
 * The outfit, as if someone were wearing it: the shirt from the Library over
 * the pants from the Library, in one 3D view. Swipe the upper half to pick
 * another shirt and the lower half to pick other pants.
 */
export function OutfitScreen() {
  const insets = useSafeAreaInsets();
  const {
    wardrobe: {garments, loaded},
    startAdd,
    wearRequest,
    clearWearRequest,
    bodyType,
  } = useWardrobeContext();
  const [shirtIndex, setShirtIndex] = useState(0);
  const [pantsIndex, setPantsIndex] = useState(0);
  // Which way the last swipe went (1 = to the next item), so the new garment
  // slides in from that side.
  const [shirtSlide, setShirtSlide] = useState(0);
  const [pantsSlide, setPantsSlide] = useState(0);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  // The garment being swiped follows the finger inside the scene.
  const scene = useRef<OutfitSceneHandle>(null);
  const {split} = layout;

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

  const changeShirt = (next: number) => {
    if (next !== shirtAt) {
      trigger('impactLight');
    }
    setShirtSlide(Math.sign(next - shirtAt));
    setShirtIndex(next);
  };
  const changePants = (next: number) => {
    if (next !== pantsAt) {
      trigger('impactLight');
    }
    setPantsSlide(Math.sign(next - pantsAt));
    setPantsIndex(next);
  };

  // "Use" in the Library viewer: put that garment on, without a slide.
  useEffect(() => {
    if (!wearRequest) {
      return;
    }
    const list = wearRequest.kind === 'shirt' ? shirts : pants;
    const index = list.findIndex(g => g.id === wearRequest.id);
    if (index >= 0) {
      if (wearRequest.kind === 'shirt') {
        setShirtSlide(0);
        setShirtIndex(index);
      } else {
        setPantsSlide(0);
        setPantsIndex(index);
      }
    }
    clearWearRequest();
  }, [wearRequest, shirts, pants, clearWearRequest]);

  const percent = (fraction: number) => `${(fraction * 100).toFixed(2)}%` as const;

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <ScreenHeader title="Outfit" subtitle="Mix and match your wardrobe" />
      <View style={styles.panel}>
        <OutfitScene
          ref={scene}
          shirt={shirt}
          pants={trousers}
          body={bodyType}
          shirtSlide={shirtSlide}
          pantsSlide={pantsSlide}
          onSplitChange={setLayout}
          style={StyleSheet.absoluteFill}
        />
        <OutfitSwipeZone
          kind="shirt"
          loaded={loaded}
          count={shirts.length}
          index={shirtAt}
          onIndexChange={changeShirt}
          onDrag={dx => scene.current?.drag('shirt', dx)}
          onDragEnd={changed => scene.current?.endDrag('shirt', changed)}
          centre={layout.shirtCentre / split}
          onAdd={() => startAdd('shirt')}
          style={[styles.top, {height: percent(split)}]}
        />
        <OutfitSwipeZone
          kind="pants"
          loaded={loaded}
          count={pants.length}
          index={pantsAt}
          onIndexChange={changePants}
          onDrag={dx => scene.current?.drag('pants', dx)}
          onDragEnd={changed => scene.current?.endDrag('pants', changed)}
          centre={(layout.pantsCentre - split) / (1 - split)}
          onAdd={() => startAdd('pants')}
          style={[styles.bottom, {top: percent(split)}]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {top: 0},
  bottom: {bottom: 0},
  root: {flex: 1, backgroundColor: theme.background},
  // No card or border: the scene blends into the screen.
  panel: {flex: 1, overflow: 'hidden'},
});
