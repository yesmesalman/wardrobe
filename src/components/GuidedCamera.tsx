import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Line, Path} from 'react-native-svg';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import {frontOutline} from '../../webview/garmentGeometry';
import {MAX_PHOTO_SIZE} from '../hooks/pickPhoto';
import {takeTempFileBase64} from '../storage/wardrobeStorage';
import type {BodyType, GarmentKind} from '../types';
import {CloseIcon} from './icons';

interface Props {
  /** The kind being photographed; the camera is open while set. */
  kind: GarmentKind | null;
  /** The body type whose model the outline shows. */
  body: BodyType;
  /** The photo, as base64 JPEG no larger than the stored photos. */
  onCapture: (photoBase64: string) => void;
  /** Pick a photo from the library instead. */
  onLibrary: () => void;
  onCancel: () => void;
}

const TIPS: Record<GarmentKind, {title: string; tip: string}> = {
  shirt: {
    title: 'Line up the shirt',
    tip: 'Lay it flat on a plain surface that stands out from it. Match the outline, with the sleeves along the lines; short sleeves end at the dashes.',
  },
  pants: {
    title: 'Line up the pants',
    tip: 'Lay them flat on a plain surface that stands out from them. Match the outline, with the legs along the lines; shorts end at the dashes.',
  },
};

// How long to wait for the camera list before saying there is no camera.
const NO_CAMERA_DELAY_MS = 1500;

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong.';

/**
 * Camera with a faint outline of the blank 3D model over the live view, so
 * the garment is photographed in the model's shape: laid flat, sleeves or legs
 * at the model's angle. The closer the photo matches, the better the fit.
 */
export function GuidedCamera({
  kind,
  body,
  onCapture,
  onLibrary,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const visible = kind !== null;
  // While the screen slides away (kind already null), keep showing its kind.
  const lastKind = useRef<GarmentKind>('shirt');
  if (kind) {
    lastKind.current = kind;
  }
  const shownKind = kind ?? lastKind.current;
  const device = useCameraDevice('back');
  const {hasPermission, canRequestPermission, requestPermission} =
    useCameraPermission();
  const photoOutput = usePhotoOutput({qualityPrioritization: 'balanced'});
  const [busy, setBusy] = useState(false);
  const [noCamera, setNoCamera] = useState(false);

  useEffect(() => {
    if (visible && canRequestPermission) {
      requestPermission();
    }
  }, [visible, canRequestPermission, requestPermission]);

  // Kept while the screen closes, so the guide doesn't flash back in.
  useEffect(() => {
    if (!visible || device) {
      return;
    }
    const timer = setTimeout(() => setNoCamera(true), NO_CAMERA_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible, device]);

  const capture = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      onCapture(await takePhoto(photoOutput));
    } catch (e) {
      Alert.alert('Could not take the photo', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const tips = TIPS[shownKind];
  const ready = hasPermission && !!device;
  let message: React.ReactNode = null;
  if (!hasPermission && !canRequestPermission) {
    message = (
      <>
        <Text style={styles.messageText}>
          Allow camera access in Settings to photograph your garments.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => Linking.openSettings()}
          style={styles.messageButton}>
          <Text style={styles.messageButtonText}>Open Settings</Text>
        </Pressable>
      </>
    );
  } else if (hasPermission && !device && noCamera) {
    message = (
      <Text style={styles.messageText}>
        There is no camera on this device. Choose a photo from the library
        instead.
      </Text>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}>
      <View style={styles.root}>
        {ready ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={visible}
            outputs={[photoOutput]}
            resizeMode="cover"
          />
        ) : null}
        <View
          style={[
            styles.overlay,
            {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16},
          ]}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onCancel}
              hitSlop={12}
              style={styles.close}>
              <CloseIcon size={24} color="#fff" />
            </Pressable>
            <Text style={styles.title}>{tips.title}</Text>
            <View style={styles.close} />
          </View>
          <Text style={styles.tip}>{tips.tip}</Text>

          <View style={styles.guide} pointerEvents="none">
            {message ? null : <GuideOutline kind={shownKind} body={body} />}
          </View>
          {message ? (
            <View style={styles.message} pointerEvents="box-none">
              {message}
            </View>
          ) : null}

          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              onPress={onLibrary}
              disabled={busy}
              hitSlop={8}
              style={styles.side}>
              <Text style={styles.sideText}>Library</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              onPress={capture}
              disabled={!ready || busy}
              style={[styles.shutter, (!ready || busy) && styles.shutterOff]}>
              {busy ? (
                <ActivityIndicator color="#1c1b1a" />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </Pressable>
            <View style={styles.side} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Takes a photo, upright and scaled down like the library's photos, and
 * returns it as base64 JPEG.
 */
async function takePhoto(
  output: ReturnType<typeof usePhotoOutput>,
): Promise<string> {
  const photo = await output.capturePhoto({flashMode: 'off'}, {});
  try {
    const image = await photo.toImageAsync();
    const scale = Math.min(
      1,
      MAX_PHOTO_SIZE / Math.max(image.width, image.height),
    );
    const sized =
      scale < 1
        ? await image.resizeAsync(
            Math.round(image.width * scale),
            Math.round(image.height * scale),
          )
        : image;
    return await takeTempFileBase64(
      await sized.saveToTemporaryFileAsync('jpg', 80),
    );
  } finally {
    photo.dispose();
  }
}

/** Faint outline of the blank model, with dashes where shorter ones end. */
function GuideOutline({kind, body}: {kind: GarmentKind; body: BodyType}) {
  const {path, cuffs, viewBox, unit} = useMemo(() => {
    const {outline, cuffs: ends} = frontOutline(kind, body);
    // SVG's y runs down; the model's runs up.
    const xs = outline.map(([x]) => x);
    const ys = outline.map(([, y]) => -y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const w = Math.max(...xs) - minX;
    const h = Math.max(...ys) - minY;
    const pad = 0.02 * Math.max(w, h);
    return {
      path: `M${outline.map(([x, y]) => `${x},${-y}`).join(' L')} Z`,
      cuffs: ends,
      viewBox: `${minX - pad} ${minY - pad} ${w + 2 * pad} ${h + 2 * pad}`,
      unit: Math.max(w, h) / 300,
    };
  }, [kind, body]);
  return (
    <Svg width="100%" height="100%" viewBox={viewBox}>
      <Path
        d={path}
        fill="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth={1.6 * unit}
        strokeLinejoin="round"
      />
      {cuffs.map(([[x1, y1], [x2, y2]], i) => (
        <Line
          key={i}
          x1={x1}
          y1={-y1}
          x2={x2}
          y2={-y2}
          stroke="rgba(255,255,255,0.75)"
          strokeWidth={1.4 * unit}
          strokeDasharray={`${5 * unit} ${4 * unit}`}
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  overlay: {...StyleSheet.absoluteFill},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  close: {width: 32, height: 32, alignItems: 'center', justifyContent: 'center'},
  title: {color: '#fff', fontSize: 17, fontWeight: '700'},
  tip: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 28,
    lineHeight: 18,
  },
  guide: {flex: 1, marginHorizontal: 24, marginVertical: 20},
  message: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  messageText: {color: '#fff', fontSize: 15, textAlign: 'center'},
  messageButton: {
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageButtonText: {color: '#1c1b1a', fontSize: 15, fontWeight: '600'},
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  side: {width: 72, alignItems: 'flex-start'},
  sideText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOff: {opacity: 0.4},
  shutterInner: {width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff'},
});
