import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChevronIcon} from '../components/icons';
import {ResetDataModal} from '../components/ResetDataModal';
import {ScreenHeader} from '../components/ScreenHeader';
import {theme} from '../constants';
import {useWardrobeContext} from '../state/WardrobeContext';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {wardrobe} = useWardrobeContext();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <ScreenHeader title="Settings" />
      <View style={styles.group}>
        <Pressable
          onPress={() => setResetOpen(true)}
          accessibilityRole="button"
          style={({pressed}) => [styles.row, pressed && styles.pressed]}>
          <Text style={styles.rowLabel}>Reset Data</Text>
          <ChevronIcon size={18} color={theme.muted} />
        </Pressable>
      </View>
      <ResetDataModal
        visible={resetOpen}
        onClose={() => setResetOpen(false)}
        onReset={wardrobe.reset}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.background},
  group: {
    marginHorizontal: 20,
    borderRadius: 14,
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  pressed: {backgroundColor: theme.line},
  rowLabel: {fontSize: 16, color: theme.ink},
});
