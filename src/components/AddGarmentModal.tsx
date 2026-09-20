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
  MAX_PER_KIND,
  theme,
  VARIANTS,
} from '../constants';
import type {Align, GarmentKind, Variant} from '../types';
import {Cutout, GarmentView, GarmentViewHandle, Photo} from './GarmentView';
import {SegmentedControl} from './SegmentedControl';
import {ZoomControl} from './ZoomControl';

export interface GarmentDraft {
  kind: GarmentKind;
  variant: Variant;
  color: string;
  align: Align;
  /** Base64 PNG of the garment cut out of the photo. */
  cutoutBase64: string;
  thumbBase64: string;
}

export interface AddGarmentProps {
  /** Base64 JPEG of the freshly picked photo; the screen is open while set. */
  photoBase64: string | null;
  /** True when the library already holds the maximum of this kind. */
  full: boolean;
  onSave: (draft: GarmentDraft) => Promise<void>;
  onRetake: () => void;
  onCancel: () => void;
}

interface Props extends AddGarmentProps {
  kind: GarmentKind;
  title: string;
}

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong.';

/**
 * Add screen shared by shirts and pants: the photographed garment is cut out
 * and fitted onto the blank 3D model of the chosen variant.
 */
export function AddGarmentModal({
  kind,
  title,
  photoBase64,
  full,
  onSave,
  onRetake,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const view = useRef<GarmentViewHandle>(null);
  const variants = VARIANTS[kind];
  const [variant, setVariant] = useState<Variant>(variants[0].value);
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
      setVariant(variants[0].value);
      setPickedColor(null);
      setRemoveBackground(true);
      setCutout(null);
      setAlign(DEFAULT_ALIGN);
      setScene('3d');
      setNotice(null);
    }
  }, [photoBase64, variants]);

  // Cut the garment out of the photo.
  useEffect(() => {
    if (!photoBase64) {
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
  }, [photoBase64, removeBackground]);

  const shownPhoto: Photo | null = cutout && {
    base64: cutout.base64,
    mime: 'image/png',
  };

  const save = async () => {
    if (processing || !cutout) {
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
        variant,
        color,
        align,
        cutoutBase64: cutout.base64,
        thumbBase64,
      });
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const aligning = scene === 'align';
  const blocked = saving || full;

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
          <Text style={styles.headerTitle}>{title}</Text>
          <Pressable onPress={onRetake} hitSlop={12} disabled={saving}>
            <Text style={styles.headerAction}>Retake</Text>
          </Pressable>
        </View>

        <View style={styles.scene}>
          <GarmentView
            ref={view}
            variant={variant}
            color={color}
            photo={shownPhoto}
            mode="fit"
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
            ? 'Drag to move, pinch or use − / + to zoom. Match the blue outline.'
            : 'Drag to rotate'}
        </Text>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <ScrollView
          style={styles.controls}
          contentContainerStyle={{paddingBottom: insets.bottom + 16}}>
          <SegmentedControl
            value={variant}
            onChange={setVariant}
            options={variants}
          />

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
              <View style={styles.alignTools}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => view.current?.resetAlign()}
                  style={styles.chip}>
                  <Text style={styles.chipText}>Reset</Text>
                </Pressable>
                <ZoomControl
                  percent={Math.round(align.sx * 100)}
                  onZoom={factor => view.current?.zoomAlign(factor)}
                />
              </View>
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

          <Text style={styles.sectionLabel}>Back and sides colour</Text>
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
                {full ? `Limit of ${MAX_PER_KIND} reached` : 'Save to library'}
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
  alignTools: {flexDirection: 'row', alignItems: 'center', gap: 8},
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
