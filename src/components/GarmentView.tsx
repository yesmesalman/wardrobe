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
import type {Align, GarmentKind, PhotoMode} from '../types';
import {SCENE_HTML} from '../webview/sceneHtml';

export interface Photo {
  base64: string;
  mime: 'image/jpeg' | 'image/png';
}

export interface Cutout {
  /** Base64 PNG of the garment cropped to its outline. */
  base64: string;
  /** Main colour of the garment (hex). */
  color: string;
  /** False when the background could not be removed (whole photo used). */
  removed: boolean;
}

export interface GarmentViewHandle {
  /** Base64 JPEG still of the garment, in the pose used on library cards. */
  snapshot: () => Promise<string>;
  /** Cuts the garment out of a photo (base64 JPEG) for "fit" mode. */
  processPhoto: (photoBase64: string, removeBackground: boolean) => Promise<Cutout>;
  /** Puts the photo back to the automatic fit. */
  resetAlign: () => void;
}

interface Props {
  kind: GarmentKind;
  color: string;
  /** Fit mode: the cut-out (PNG). Print mode: the photo (JPEG). */
  photo?: Photo | null;
  mode?: PhotoMode;
  align?: Align;
  /** '3d' to look around, 'align' to line the photo up with the model. */
  view?: '3d' | 'align';
  /** Turn slowly while untouched (dragging always spins it 360°). */
  autoRotate?: boolean;
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
      kind,
      color,
      photo,
      mode = 'print',
      align = DEFAULT_ALIGN,
      view = '3d',
      autoRotate = true,
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
            kind,
            photo: photoUri,
            mode,
            align: initialAlign.current,
          })})`,
        );
      }
    }, [ready, kind, photoUri, mode, run]);

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
        run(`window.__setAutoRotate(${autoRotate})`);
      }
    }, [ready, autoRotate, run]);

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
        processPhoto: async (photoBase64, removeBackground) => {
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
                )}, ${removeBackground})`,
              ),
          );
        },
        resetAlign: () => run('window.__resetAlign()'),
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
              base64: stripDataUrl(message.data),
              color: message.color,
              removed: message.removed,
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
