import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AddItemFab} from '../components/AddItemFab';
import {theme} from '../constants';

/** Placeholder: outfits are not built yet. */
export function OutfitScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <View style={styles.header}>
        <Text style={styles.title}>Outfit</Text>
        <Text style={styles.subtitle}>Mix and match your wardrobe</Text>
      </View>
      <AddItemFab />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.background},
  header: {paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16},
  title: {fontSize: 32, fontWeight: '800', color: theme.ink},
  subtitle: {fontSize: 15, color: theme.muted, marginTop: 2},
});
