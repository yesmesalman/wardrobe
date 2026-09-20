import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, View, ViewStyle} from 'react-native';
import {WebView, WebViewMessageEvent} from 'react-native-webview';
import {theme} from '../constants';
import {readFileBase64} from '../storage/wardrobeStorage';
import type {Garment} from '../types';
import {SCENE_HTML} from '../webview/sceneHtml';

interface Props {
  shirt: Garment | null;
  pants: Garment | null;
  /**
   * Which side a newly chosen garment slides in from: 1 from the right (the
   * next item), -1 from the left (the previous one), 0 for no slide.
   */
  shirtSlide?: number;
  pantsSlide?: number;
  style?: ViewStyle;
  /** Fraction of the height, from the top, where the shirt meets the pants. */
  onSplitChange?: (split: number) => void;
}

interface Loaded {
  id: string;
  photo: string;
}

/** The image a garment is drawn with: its cut-out, or the photo for old prints. */
async function loadPhoto(garment: Garment): Promise<Loaded> {
  const fit = garment.mode === 'fit' && garment.cutoutFile;
  const base64 = await readFileBase64(
    fit ? (garment.cutoutFile as string) : garment.photoFile,
  );
  return {
    id: garment.id,
    photo: `data:${fit ? 'image/png' : 'image/jpeg'};base64,${base64}`,
  };
}

const spec = (
  garment: Garment | null,
  loaded: Loaded | null,
  slide: number,
) =>
  garment && loaded && loaded.id === garment.id
    ? {
        id: garment.id,
        slide,
        variant: garment.variant,
        photo: loaded.photo,
        mode: garment.mode,
        color: garment.color,
        align: garment.align,
      }
    : null;

/**
 * A shirt over pants in one 3D scene, as if someone were wearing them. The
 * scene is a fixed front view; the app puts swipe zones on top of it.
 */
export function OutfitScene({
  shirt,
  pants,
  shirtSlide = 0,
  pantsSlide = 0,
  style,
  onSplitChange,
}: Props) {
  const web = useRef<WebView<object>>(null);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const [shirtImage, setShirtImage] = useState<Loaded | null>(null);
  const [pantsImage, setPantsImage] = useState<Loaded | null>(null);

  // Read the images for whichever garments are on screen.
  useEffect(() => {
    let cancelled = false;
    if (!shirt) {
      setShirtImage(null);
    } else {
      loadPhoto(shirt).then(
        r => !cancelled && setShirtImage(r),
        () => !cancelled && setShirtImage(null),
      );
    }
    return () => {
      cancelled = true;
    };
  }, [shirt]);

  useEffect(() => {
    let cancelled = false;
    if (!pants) {
      setPantsImage(null);
    } else {
      loadPhoto(pants).then(
        r => !cancelled && setPantsImage(r),
        () => !cancelled && setPantsImage(null),
      );
    }
    return () => {
      cancelled = true;
    };
  }, [pants]);

  const shirtSpec = spec(shirt, shirtImage, shirtSlide);
  const pantsSpec = spec(pants, pantsImage, pantsSlide);
  // Wait for images so a garment never flashes as a plain colour.
  const waiting = (shirt && !shirtSpec) || (pants && !pantsSpec);

  useEffect(() => {
    if (ready && !waiting) {
      web.current?.injectJavaScript(
        `window.__setOutfit(${JSON.stringify({
          shirt: shirtSpec,
          pants: pantsSpec,
        })});true;`,
      );
    }
    // The specs are rebuilt every render; the garments and images are the inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, waiting, shirt?.id, pants?.id, shirtImage?.id, pantsImage?.id]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'ready') {
        setReady(true);
      } else if (message.type === 'loaded') {
        setShown(true);
      } else if (message.type === 'outfitLayout') {
        onSplitChange?.(message.split);
      } else if (message.type === 'error') {
        console.warn('3D scene error:', message.message);
      }
    },
    [onSplitChange],
  );

  return (
    <View style={[styles.container, style]}>
      <WebView<object>
        ref={web}
        source={{html: SCENE_HTML}}
        originWhitelist={['*']}
        onMessage={onMessage}
        // Draw the scene in the screen's own colour, so it has no visible edge.
        injectedJavaScriptBeforeContentLoaded={`window.__BACKGROUND='${theme.background}';true;`}
        // A (re)loaded page starts empty and announces itself again.
        onLoadStart={() => {
          setReady(false);
          setShown(false);
        }}
        style={styles.web}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled
        allowFileAccess={false}
        automaticallyAdjustContentInsets={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
      {shown ? null : (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator color={theme.muted} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {backgroundColor: theme.background, overflow: 'hidden'},
  web: {flex: 1, backgroundColor: theme.background},
  loader: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
  },
});
