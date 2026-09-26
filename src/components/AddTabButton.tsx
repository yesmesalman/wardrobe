import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {theme} from '../constants';
import {useWardrobeContext} from '../state/WardrobeContext';
import {PlusIcon} from './icons';

/** Large round "+" in the centre of the tab bar; starts the add-item flow. */
export function AddTabButton() {
  const {startAdd} = useWardrobeContext();
  return (
    <View style={styles.slot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add item"
        onPress={() => startAdd()}
        hitSlop={8}
        style={({pressed}) => [styles.button, pressed && styles.pressed]}>
        <PlusIcon color={theme.accentText} size={28} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {flex: 1, alignItems: 'center'},
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -14,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 3},
  },
  pressed: {opacity: 0.85},
});
