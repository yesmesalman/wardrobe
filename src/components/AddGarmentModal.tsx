import React, {useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  DEFAULT_COLOR,
  GARMENT_COLORS,
  KIND_LABELS,
  MAX_PER_KIND,
  theme,
} from '../constants';
import type {GarmentKind} from '../types';
import {GarmentView, GarmentViewHandle} from './GarmentView';
import {SegmentedControl} from './SegmentedControl';

interface Props {
  /** Base64 JPEG of the freshly picked photo; the modal is open while set. */
  photoBase64: string | null;
  initialKind: GarmentKind;
  isFull: (kind: GarmentKind) => boolean;
  onSave: (
    kind: GarmentKind,
    color: string,
    thumbBase64: string,
  ) => Promise<void>;
  onRetake: () => void;
  onCancel: () => void;
}

export function AddGarmentModal({
  photoBase64,
  initialKind,
  isFull,
  onSave,
  onRetake,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState(initialKind);
  const [color, setColor] = useState(DEFAULT_COLOR[initialKind]);
  const [saving, setSaving] = useState(false);
  const view = useRef<GarmentViewHandle>(null);

  // Start from the current library tab every time the modal opens.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (photoBase64 !== openedFor) {
    setOpenedFor(photoBase64);
    if (photoBase64) {
      setKind(initialKind);
      setColor(DEFAULT_COLOR[initialKind]);
    }
  }

  const changeKind = (next: GarmentKind) => {
    // Keep a colour the user picked; only swap the untouched default.
    if (color === DEFAULT_COLOR[kind]) {
      setColor(DEFAULT_COLOR[next]);
    }
    setKind(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const thumbBase64 = await view.current?.snapshot();
      if (!thumbBase64) {
        throw new Error('The 3D preview is not ready yet.');
      }
      await onSave(kind, color, thumbBase64);
    } catch (e) {
      Alert.alert(
        'Could not save',
        e instanceof Error ? e.message : 'Something went wrong.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={photoBase64 !== null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}>
      <View style={[styles.root, {paddingTop: insets.top}]}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={12} disabled={saving}>
            <Text style={styles.headerAction}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>New garment</Text>
          <Pressable onPress={onRetake} hitSlop={12} disabled={saving}>
            <Text style={styles.headerAction}>Retake</Text>
          </Pressable>
        </View>

        <GarmentView
          ref={view}
          kind={kind}
          color={color}
          photoBase64={photoBase64}
          style={styles.scene}
        />
        <Text style={styles.hint}>Drag to rotate</Text>

        <ScrollView
          style={styles.controls}
          contentContainerStyle={{paddingBottom: insets.bottom + 16}}>
          <SegmentedControl
            value={kind}
            onChange={changeKind}
            options={(['shirt', 'pants'] as const).map(value => ({
              value,
              label: isFull(value)
                ? `${KIND_LABELS[value].plural} (full)`
                : KIND_LABELS[value].plural,
              disabled: isFull(value),
            }))}
          />

          <Text style={styles.sectionLabel}>Fabric colour</Text>
          <View style={styles.swatches}>
            {GARMENT_COLORS.map(swatch => (
              <Pressable
                key={swatch.hex}
                accessibilityRole="button"
                accessibilityLabel={swatch.name}
                accessibilityState={{selected: swatch.hex === color}}
                onPress={() => setColor(swatch.hex)}
                style={[
                  styles.swatch,
                  {backgroundColor: swatch.hex},
                  swatch.hex === color && styles.swatchSelected,
                ]}
              />
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={saving || isFull(kind)}
            onPress={save}
            style={[styles.save, (saving || isFull(kind)) && styles.saveDisabled]}>
            {saving ? (
              <ActivityIndicator color={theme.accentText} />
            ) : (
              <Text style={styles.saveText}>
                {isFull(kind)
                  ? `Limit of ${MAX_PER_KIND} reached`
                  : 'Save to library'}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {fontSize: 17, fontWeight: '700', color: theme.ink},
  headerAction: {fontSize: 16, color: theme.accent, fontWeight: '500'},
  scene: {flex: 1, marginHorizontal: 16, borderRadius: 24},
  hint: {
    textAlign: 'center',
    color: theme.muted,
    fontSize: 13,
    marginTop: 8,
  },
  controls: {flexGrow: 0, paddingHorizontal: 20, paddingTop: 12},
  sectionLabel: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
    color: theme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  swatches: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.muted,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: theme.accent,
  },
  save: {
    marginTop: 24,
    height: 54,
    borderRadius: 16,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: {opacity: 0.5},
  saveText: {color: theme.accentText, fontSize: 17, fontWeight: '700'},
});
