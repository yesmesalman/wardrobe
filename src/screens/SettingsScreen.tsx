import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {theme} from '../constants';

/** Placeholder: there are no settings yet. */
export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.background},
  header: {paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16},
  title: {fontSize: 32, fontWeight: '800', color: theme.ink},
});
