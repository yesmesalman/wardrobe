import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ScreenHeader} from '../components/ScreenHeader';
import {theme} from '../constants';

/** Placeholder: outfits are not built yet. */
export function OutfitScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <ScreenHeader title="Outfit" subtitle="Mix and match your wardrobe" showAdd />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.background},
});
