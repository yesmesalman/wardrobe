import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MAX_PER_KIND, theme} from '../constants';
import type {GarmentKind} from '../types';
import {PantsIcon, ShirtIcon} from './icons';

interface Props {
  visible: boolean;
  counts: Record<GarmentKind, number>;
  onChoose: (kind: GarmentKind) => void;
  onClose: () => void;
}

const OPTIONS: {kind: GarmentKind; label: string}[] = [
  {kind: 'shirt', label: 'Shirt'},
  {kind: 'pants', label: 'Pants'},
];

/** Bottom sheet asking whether the new item is a shirt or pants. */
export function AddItemSheet({visible, counts, onChoose, onClose}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallows taps so pressing the sheet does not close it. */}
        <Pressable
          style={[styles.sheet, {paddingBottom: insets.bottom + 20}]}
          onPress={() => {}}>
          <Text style={styles.title}>Add item</Text>
          <Text style={styles.subtitle}>What are you adding?</Text>
          <View style={styles.options}>
            {OPTIONS.map(({kind, label}) => {
              const full = counts[kind] >= MAX_PER_KIND;
              const Icon = kind === 'shirt' ? ShirtIcon : PantsIcon;
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${label.toLowerCase()}`}
                  disabled={full}
                  onPress={() => onChoose(kind)}
                  style={({pressed}) => [
                    styles.option,
                    full && styles.optionFull,
                    pressed && styles.optionPressed,
                  ]}>
                  <Icon size={54} color={theme.accent} strokeWidth={1.4} />
                  <Text style={styles.optionLabel}>{label}</Text>
                  <Text style={styles.optionCount}>
                    {full ? 'Full' : `${counts[kind]}/${MAX_PER_KIND}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(28,27,26,0.4)',
  },
  sheet: {
    backgroundColor: theme.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  title: {fontSize: 22, fontWeight: '800', color: theme.ink},
  subtitle: {fontSize: 15, color: theme.muted, marginTop: 2},
  options: {flexDirection: 'row', gap: 14, marginTop: 20},
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 22,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    gap: 8,
  },
  optionFull: {opacity: 0.45},
  optionPressed: {opacity: 0.8},
  optionLabel: {fontSize: 17, fontWeight: '700', color: theme.ink},
  optionCount: {fontSize: 13, color: theme.muted},
  cancel: {alignSelf: 'center', marginTop: 18},
  cancelText: {fontSize: 16, color: theme.accent, fontWeight: '600'},
});
