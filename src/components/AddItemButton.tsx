import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {theme} from '../constants';
import {useWardrobeContext} from '../state/WardrobeContext';

/** Compact "Add item" button for the top right of a screen header. */
export function AddItemButton() {
  const {startAdd} = useWardrobeContext();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add item"
      onPress={startAdd}
      hitSlop={8}
      style={({pressed}) => [styles.button, pressed && styles.pressed]}>
      <Text style={styles.text}>+ Add item</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {opacity: 0.85},
  text: {color: theme.accentText, fontSize: 14, fontWeight: '700'},
});
