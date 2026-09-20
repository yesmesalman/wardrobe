import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  DEFAULT_ALIGN,
  DEFAULT_COLOR,
  GARMENT_COLORS,
  KIND_LABELS,
  MAX_PER_KIND,
  theme,
} from '../constants';
import type {Align, GarmentKind, PhotoMode} from '../types';
import {Cutout, GarmentView, GarmentViewHandle, Photo} from './GarmentView';
import {SegmentedControl} from './SegmentedControl';

export interface GarmentDraft {
  kind: GarmentKind;
  mode: PhotoMode;
  color: string;
  align: Align;
  /** Base64 PNG of the garment cut out of the photo (fit mode). */
  cutoutBase64?: string;
  thumbBase64: string;
}

interface Props {
  /** Base64 JPEG of the freshly picked photo; the modal is open while set. */
  photoBase64: string | null;
  initialKind: GarmentKind;
  isFull: (kind: GarmentKind) => boolean;
  onSave: (draft: GarmentDraft) => Promise<void>;
  onRetake: () => void;
  onCancel: () => void;
}

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong.';

export function AddGarmentModal({
  photoBase64,
  initialKind,
  isFull,
  onSave,
  onRetake,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const view = useRef<GarmentViewHandle>(null);
  const [kind, setKind] = useState(initialKind);
  const [mode, setMode] = useState<PhotoMode>('fit');
  const [pickedColor, setPickedColor] = useState<string | null>(null);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [cutout, setCutout] = useState<Cutout | null>(null);
  const [align, setAlign] = useState<Align>(DEFAULT_ALIGN);
  const [scene, setScene] = useState<'3d' | 'align'>('3d');
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The fabric colour follows the garment in the photo until the user picks one.
  const color = pickedColor ?? cutout?.color ?? DEFAULT_COLOR[kind];

  // Start fresh every time a new photo arrives.
  useEffect(() => {
    if (photoBase64) {
      setKind(initialKind);
      setMode('fit');
      setPickedColor(null);
      setRemoveBackground(true);
      setCutout(null);
      setAlign(DEFAULT_ALIGN);
      setScene('3d');
      setNotice(null);
    }
  }, [photoBase64, initialKind]);

  // Fit mode: cut the garment out of the photo.
  useEffect(() => {
    if (!photoBase64 || mode !== 'fit') {
      return;
    }
    let cancelled = false;
    setProcessing(true);
    setNotice(null);
    view.current
      ?.processPhoto(photoBase64, removeBackground)
      .then(result => {
        if (cancelled) {
          return;
        }
        setCutout(result);
        setAlign(DEFAULT_ALIGN);
        if (removeBackground && !result.removed) {
          setNotice(
            "Couldn't find the garment's outline, so the whole photo is used. Try a plain background.",
          );
        }
      })
      .catch(e => !cancelled && setNotice(errorMessage(e)))
      .finally(() => !cancelled && setProcessing(false));
    return () => {
      cancelled = true;
    };
  }, [photoBase64, mode, removeBackground]);

  const changeMode = (next: PhotoMode) => {
    setMode(next);
    if (next === 'print') {
      setScene('3d');
    }
  };

  const shownPhoto: Photo | null =
    mode === 'fit'
      ? cutout && {base64: cutout.base64, mime: 'image/png'}
      : photoBase64
        ? {base64: photoBase64, mime: 'image/jpeg'}
        : null;

  const save = async () => {
    if (mode === 'fit' && (processing || !cutout)) {
      Alert.alert('One moment', 'The photo is still being prepared.');
      return;
    }
    setSaving(true);
    try {
      const thumbBase64 = await view.current?.snapshot();
      if (!thumbBase64) {
        throw new Error('The 3D preview is not ready yet.');
      }
      await onSave({
        kind,
        mode,
        color,
        align,
        cutoutBase64: mode === 'fit' ? cutout?.base64 : undefined,
        thumbBase64,
      });
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const aligning = mode === 'fit' && scene === 'align';
  const blocked = saving || isFull(kind);

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

        <View style={styles.scene}>
          <GarmentView
            ref={view}
            kind={kind}
            color={color}
            photo={shownPhoto}
            mode={mode}
            align={align}
            view={aligning ? 'align' : '3d'}
            onAlignChange={setAlign}
            onViewChange={setScene}
            style={styles.view}
          />
          {processing ? (
            <View style={styles.processing} pointerEvents="none">
              <ActivityIndicator color={theme.ink} />
              <Text style={styles.processingText}>Preparing photo…</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.hint}>
          {aligning
            ? 'Drag to move, pinch to resize. Match the blue outline.'
            : 'Drag to rotate'}
        </Text>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <ScrollView
          style={styles.controls}
          contentContainerStyle={{paddingBottom: insets.bottom + 16}}>
          <SegmentedControl
            value={kind}
            onChange={setKind}
            options={(['shirt', 'pants'] as const).map(value => ({
              value,
              label: isFull(value)
                ? `${KIND_LABELS[value].plural} (full)`
                : KIND_LABELS[value].plural,
              disabled: isFull(value),
            }))}
          />

          <View style={styles.gap} />
          <SegmentedControl
            value={mode}
            onChange={changeMode}
            options={[
              {value: 'fit', label: 'Fit photo to garment'},
              {value: 'print', label: 'Print / logo'},
            ]}
          />

          {mode === 'fit' ? (
            <View style={styles.fitRow}>
              <Pressable
                accessibilityRole="button"
                disabled={processing || !cutout}
                onPress={() => setScene(aligning ? '3d' : 'align')}
                style={[styles.chip, aligning && styles.chipOn]}>
                <Text style={[styles.chipText, aligning && styles.chipTextOn]}>
                  {aligning ? 'Done adjusting' : 'Adjust fit'}
                </Text>
              </Pressable>
              {aligning ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => view.current?.resetAlign()}
                  style={styles.chip}>
                  <Text style={styles.chipText}>Reset</Text>
                </Pressable>
              ) : (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Remove background</Text>
                  <Switch
                    value={removeBackground}
                    onValueChange={setRemoveBackground}
                    disabled={processing}
                  />
                </View>
              )}
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>
            {mode === 'fit' ? 'Back and sides colour' : 'Fabric colour'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.swatches}>
            {GARMENT_COLORS.map(swatch => (
              <Pressable
                key={swatch.hex}
                accessibilityRole="button"
                accessibilityLabel={swatch.name}
                accessibilityState={{selected: swatch.hex === color}}
                onPress={() => setPickedColor(swatch.hex)}
                style={[
                  styles.swatch,
                  {backgroundColor: swatch.hex},
                  swatch.hex === color && styles.swatchSelected,
                ]}
              />
            ))}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            disabled={blocked}
            onPress={save}
            style={[styles.save, blocked && styles.saveDisabled]}>
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
  scene: {flex: 1, marginHorizontal: 16},
  view: {flex: 1, borderRadius: 24},
  processing: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(236,231,223,0.75)',
    borderRadius: 24,
  },
  processingText: {color: theme.ink, fontSize: 14, fontWeight: '600'},
  hint: {
    textAlign: 'center',
    color: theme.muted,
    fontSize: 13,
    marginTop: 8,
  },
  notice: {
    textAlign: 'center',
    color: theme.danger,
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 24,
  },
  controls: {flexGrow: 0, paddingHorizontal: 20, paddingTop: 12},
  gap: {height: 10},
  fitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {backgroundColor: theme.accent},
  chipText: {color: theme.accent, fontSize: 14, fontWeight: '600'},
  chipTextOn: {color: theme.accentText},
  switchRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  switchLabel: {color: theme.ink, fontSize: 14},
  sectionLabel: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
    color: theme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  swatches: {flexDirection: 'row', gap: 12, paddingRight: 8},
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.muted,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: theme.accent,
  },
  save: {
    marginTop: 20,
    height: 54,
    borderRadius: 16,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: {opacity: 0.5},
  saveText: {color: theme.accentText, fontSize: 17, fontWeight: '700'},
});
