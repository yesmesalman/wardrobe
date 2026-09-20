import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {theme} from '../constants';
import {useWardrobeContext} from '../state/WardrobeContext';

/** Floating "Add item" button, shown above the bottom tab bar. */
export function AddItemFab() {
  const {startAdd} = useWardrobeContext();
  const tabBarHeight = useBottomTabBarHeight();
  return (
    <View style={[styles.wrap, {bottom: tabBarHeight + 16}]} pointerEvents="box-none">
      <Pressable accessibilityRole="button" onPress={startAdd} style={styles.fab}>
        <Text style={styles.text}>+  Add item</Text>
      </Pressable>
    </View>
  );
}

/** Space a scrolling list needs at the bottom so the button never covers it. */
export const FAB_CLEARANCE = 90;

const styles = StyleSheet.create({
  wrap: {position: 'absolute', left: 0, right: 0, alignItems: 'center'},
  fab: {
    backgroundColor: theme.accent,
    paddingHorizontal: 28,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 4,
  },
  text: {color: theme.accentText, fontSize: 17, fontWeight: '700'},
});
