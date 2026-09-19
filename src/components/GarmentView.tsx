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
import {theme} from '../constants';
import type {GarmentKind} from '../types';
import {SCENE_HTML} from '../webview/sceneHtml';

export interface GarmentViewHandle {
  /** Base64 JPEG still of the garment, in the pose used on library cards. */
  snapshot: () => Promise<string>;
}

interface Props {
  kind: GarmentKind;
  color: string;
  /** Base64 JPEG of the user's photo, projected onto the garment. */
  photoBase64?: string | null;
  /** Turn slowly while untouched (dragging always spins it 360°). */
  autoRotate?: boolean;
  style?: ViewStyle;
}

interface Pending {
  resolve: (base64: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const SNAPSHOT_TIMEOUT_MS = 10000;

/**
 * Interactive 3D garment. The blank shirt/pants model and the photo decal are
 * rendered by three.js inside a WebView (see webview/scene.js).
 */
export const GarmentView = forwardRef<GarmentViewHandle, Props>(
  function GarmentViewImpl(
    {kind, color, photoBase64, autoRotate = true, style},
    ref,
  ) {
    const web = useRef<WebView<object>>(null);
    const [ready, setReady] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const pending = useRef(new Map<string, Pending>());
    const counter = useRef(0);

    const run = useCallback((code: string) => {
      web.current?.injectJavaScript(`${code};true;`);
    }, []);

    // Model and photo: the page swaps the garment when either changes.
    useEffect(() => {
      if (ready) {
        setLoaded(false);
        run(
          `window.__setGarment(${JSON.stringify({
            kind,
            photo: photoBase64 ? `data:image/jpeg;base64,${photoBase64}` : null,
          })})`,
        );
      }
    }, [ready, kind, photoBase64, run]);

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

    useEffect(
      () => () => pending.current.forEach(p => clearTimeout(p.timer)),
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        snapshot: () =>
          new Promise<string>((resolve, reject) => {
            const id = String((counter.current += 1));
            const timer = setTimeout(() => {
              pending.current.delete(id);
              reject(new Error('Timed out capturing the 3D preview.'));
            }, SNAPSHOT_TIMEOUT_MS);
            pending.current.set(id, {resolve, reject, timer});
            run(`window.__snapshot(${JSON.stringify(id)})`);
          }),
      }),
      [run],
    );

    const onMessage = useCallback((event: WebViewMessageEvent) => {
      const message = JSON.parse(event.nativeEvent.data);
      switch (message.type) {
        case 'ready':
          setReady(true);
          break;
        case 'loaded':
          setLoaded(true);
          break;
        case 'snapshot':
        case 'snapshotError': {
          const request = pending.current.get(message.id);
          if (request) {
            clearTimeout(request.timer);
            pending.current.delete(message.id);
            if (message.type === 'snapshot') {
              request.resolve(message.data.replace(/^data:image\/jpeg;base64,/, ''));
            } else {
              request.reject(new Error(message.message));
            }
          }
          break;
        }
        case 'error':
          console.warn('3D scene error:', message.message);
          break;
      }
    }, []);

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
