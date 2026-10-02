import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {ActivityIndicator, StyleSheet, View, ViewStyle} from 'react-native';
import {WebView, WebViewMessageEvent} from 'react-native-webview';
import {DEFAULT_ALIGN, theme} from '../constants';
import type {Align, GarmentKind, PhotoMode, Variant} from '../types';
import {SCENE_HTML} from '../webview/sceneHtml';

export interface Photo {
  base64: string;
  mime: 'image/jpeg' | 'image/png';
}

export interface Cutout {
  /**
   * Base64 PNG of the garment for each of the kind's variants, warped into
   * the shape of that variant's standard model.
   */
  images: Partial<Record<Variant, string>>;
  /** Main colour of the garment (hex). */
  color: string;
  /** False when the background could not be removed (whole photo used). */
  removed: boolean;
  /** The variant the garment looks like (e.g. long sleeves), if measured. */
  variant: Variant | null;
}

export interface GarmentViewHandle {
  /** Base64 JPEG still of the garment, in the pose used on library cards. */
  snapshot: () => Promise<string>;
  /**
   * Cuts the garment out of a photo (base64 JPEG) for "fit" mode and warps it
   * onto each of the kind's standard models.
   */
  processPhoto: (
    photoBase64: string,
    removeBackground: boolean,
    kind: GarmentKind,
  ) => Promise<Cutout>;
  /** Puts the photo back to the automatic fit. */
  resetAlign: () => void;
  /** Zooms the photo over the model by `factor` (1.1 = 10% bigger). */
  zoomAlign: (factor: number) => void;
}

interface Props {
  variant: Variant;
  color: string;
  /** Fit mode: the cut-out (PNG). Print mode: the photo (JPEG). */
  photo?: Photo | null;
  mode?: PhotoMode;
  align?: Align;
  /** '3d' to look around, 'align' to line the photo up with the model. */
  view?: '3d' | 'align';
  /** Sway gently while untouched (dragging always tilts it a little). */
  sway?: boolean;
  style?: ViewStyle;
  onAlignChange?: (align: Align) => void;
  /** The page switched view by itself (e.g. before taking a snapshot). */
  onViewChange?: (view: '3d' | 'align') => void;
}

interface Pending {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const SNAPSHOT_TIMEOUT_MS = 10000;
const PROCESS_TIMEOUT_MS = 40000;

const stripDataUrl = (dataUrl: string) => dataUrl.replace(/^data:[^,]*,/, '');

/**
 * Interactive 3D garment. The blank shirt/pants model and the photo are
 * rendered by three.js inside a WebView (see webview/scene.js).
 */
export const GarmentView = forwardRef<GarmentViewHandle, Props>(
  function GarmentViewImpl(
    {
      variant,
      color,
      photo,
      mode = 'print',
      align = DEFAULT_ALIGN,
      view = '3d',
      sway = true,
      style,
      onAlignChange,
      onViewChange,
    },
    ref,
  ) {
    const web = useRef<WebView<object>>(null);
    const [ready, setReady] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const waiting = useRef<(() => void)[]>([]);
    const pending = useRef(new Map<string, Pending>());
    const counter = useRef(0);

    const run = useCallback((code: string) => {
      web.current?.injectJavaScript(`${code};true;`);
    }, []);

    // Model, photo and mode: the page swaps the garment when any changes.
    const photoUri = photo ? `data:${photo.mime};base64,${photo.base64}` : null;
    const initialAlign = useRef(align);
    initialAlign.current = align;
    useEffect(() => {
      if (ready) {
        setLoaded(false);
        run(
          `window.__setGarment(${JSON.stringify({
            variant,
            photo: photoUri,
            mode,
            align: initialAlign.current,
          })})`,
        );
      }
    }, [ready, variant, photoUri, mode, run]);

    useEffect(() => {
      if (ready) {
        run(`window.__setAlign(${JSON.stringify(align)})`);
      }
    }, [ready, align, run]);

    useEffect(() => {
      if (ready) {
        run(`window.__setColor(${JSON.stringify(color)})`);
      }
    }, [ready, color, run]);

    useEffect(() => {
      if (ready) {
        run(`window.__setSway(${sway})`);
      }
    }, [ready, sway, run]);

    useEffect(() => {
      if (ready) {
        run(`window.__setView(${JSON.stringify(view)})`);
      }
    }, [ready, view, loaded, run]);

    useEffect(
      () => () => pending.current.forEach(p => clearTimeout(p.timer)),
      [],
    );

    const request = useCallback(
      <T,>(timeoutMs: number, timeoutMessage: string, start: (id: string) => void) =>
        new Promise<T>((resolve, reject) => {
          const id = String((counter.current += 1));
          const timer = setTimeout(() => {
            pending.current.delete(id);
            reject(new Error(timeoutMessage));
          }, timeoutMs);
          pending.current.set(id, {resolve, reject, timer});
          start(id);
        }),
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        snapshot: () =>
          request<string>(
            SNAPSHOT_TIMEOUT_MS,
            'Timed out capturing the 3D preview.',
            id => run(`window.__snapshot(${JSON.stringify(id)})`),
          ),
        processPhoto: async (photoBase64, removeBackground, kind) => {
          // The page may still be starting up.
          await new Promise<void>(resolve => {
            if (ready) {
              resolve();
            } else {
              waiting.current.push(resolve);
            }
          });
          return request<Cutout>(
            PROCESS_TIMEOUT_MS,
            'Timed out preparing the photo.',
            id =>
              run(
                `window.__processPhoto(${JSON.stringify(id)}, ${JSON.stringify(
                  `data:image/jpeg;base64,${photoBase64}`,
                )}, ${removeBackground}, ${JSON.stringify(kind)})`,
              ),
          );
        },
        resetAlign: () => run('window.__resetAlign()'),
        zoomAlign: factor => run(`window.__zoomAlign(${factor})`),
      }),
      [ready, request, run],
    );

    const settle = (id: string, ok: boolean, value: unknown) => {
      const item = pending.current.get(id);
      if (item) {
        clearTimeout(item.timer);
        pending.current.delete(id);
        ok ? item.resolve(value) : item.reject(new Error(String(value)));
      }
    };

    const onMessage = useCallback(
      (event: WebViewMessageEvent) => {
        const message = JSON.parse(event.nativeEvent.data);
        switch (message.type) {
          case 'ready':
            setReady(true);
            waiting.current.splice(0).forEach(resolve => resolve());
            break;
          case 'loaded':
            setLoaded(true);
            break;
          case 'align':
            onAlignChange?.(message.align);
            break;
          case 'view':
            onViewChange?.(message.view);
            break;
          case 'snapshot':
            settle(message.id, true, stripDataUrl(message.data));
            break;
          case 'cutout':
            settle(message.id, true, {
              images: Object.fromEntries(
                Object.entries(message.cutouts as Record<string, string>).map(
                  ([key, data]) => [key, stripDataUrl(data)],
                ),
              ),
              color: message.color,
              removed: message.removed,
              variant: message.variant ?? null,
            } satisfies Cutout);
            break;
          case 'snapshotError':
          case 'cutoutError':
            settle(message.id, false, message.message);
            break;
          case 'error':
            console.warn('3D scene error:', message.message);
            break;
        }
      },
      [onAlignChange, onViewChange],
    );

    return (
      <View style={[styles.container, style]}>
        <WebView<object>
          ref={web}
          source={{html: SCENE_HTML}}
          originWhitelist={['*']}
          onMessage={onMessage}
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
        {loaded ? null : (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator color={theme.muted} />
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {backgroundColor: theme.sceneBottom, overflow: 'hidden'},
  web: {flex: 1, backgroundColor: theme.sceneBottom},
  loader: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.sceneBottom,
  },
});
