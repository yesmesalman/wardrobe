import {Platform} from 'react-native';
import {
  CachesDirectoryPath,
  copyFileAssets,
  exists,
  MainBundlePath,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import type {InferenceSession} from 'onnxruntime-react-native';

/**
 * Finds the garment in a photo with U²-Netp, a small background-removal model
 * (src/assets/ai/u2netp.onnx, prepared by scripts/prepare-u2netp.py), run on
 * the device by ONNX Runtime. The result is a 320×320 mask the WebView's
 * cut-out uses instead of flood-filling the background; when the model can't
 * run here, there is no mask and the flood-fill takes over.
 */

const SIZE = 320;
// The model was trained on images normalised like this (ImageNet).
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

type Ort = typeof import('onnxruntime-react-native');
type NitroImages = typeof import('react-native-nitro-image');

// Native modules are loaded on first use, so the app still starts (and the
// flood-fill still works) if one is missing.
const ort = (): Ort => require('onnxruntime-react-native');
const nitroImages = (): NitroImages => require('react-native-nitro-image');

let session: Promise<InferenceSession> | null = null;

/** Where the model file is: in the app bundle (iOS) or its assets (Android). */
async function modelPath(): Promise<string> {
  if (Platform.OS === 'android') {
    // ONNX Runtime needs a real file; assets live inside the APK.
    const path = `${CachesDirectoryPath}/u2netp.onnx`;
    if (!(await exists(path))) {
      await copyFileAssets('u2netp.onnx', path);
    }
    return path;
  }
  return `${MainBundlePath}/u2netp.onnx`;
}

/** Loads the model once; a failed load is tried again next time. */
function loadSession(): Promise<InferenceSession> {
  if (!session) {
    session = modelPath().then(path => ort().InferenceSession.create(path));
    session.catch(() => {
      session = null;
    });
  }
  return session;
}

/** Starts loading the model early (e.g. when the add screen opens). */
export function prepareGarmentMask(): void {
  loadSession().catch(() => {});
}

/** The photo shrunk to the model's 320×320 input, as raw pixels. */
async function photoPixels(photoBase64: string) {
  const path = `${CachesDirectoryPath}/garment-mask-input.jpg`;
  await writeFile(path, photoBase64, 'base64');
  try {
    const {Images} = nitroImages();
    const image = await Images.loadFromFileAsync(path);
    const small = await image.resizeAsync(SIZE, SIZE);
    return await small.toRawPixelDataAsync();
  } finally {
    unlink(path).catch(() => {});
  }
}

/**
 * The garment's mask for a photo (base64 JPEG): 320×320 bytes, 0 for the
 * background up to 255 for the garment, base64-encoded. Null when the model
 * isn't available on this device or fails.
 */
export async function garmentMask(photoBase64: string): Promise<string | null> {
  try {
    const model = await loadSession();
    const raw = await photoPixels(photoBase64);
    const bytes = new Uint8Array(raw.buffer);
    // The byte order varies (BGRA on iOS, RGBA on Android), and rows may be
    // padded.
    const order = raw.pixelFormat.replace('X', 'A');
    const channel = ['R', 'G', 'B'].map(c => order.indexOf(c));
    const stride = bytes.length / raw.height;
    if (channel.includes(-1) || stride < raw.width * 4) {
      return null;
    }
    const at = (p: number, c: number) =>
      bytes[Math.floor(p / SIZE) * stride + (p % SIZE) * 4 + channel[c]];

    // Like the model's training: scale by the brightest value, then normalise.
    let max = 1;
    for (let p = 0; p < SIZE * SIZE; p++) {
      max = Math.max(max, at(p, 0), at(p, 1), at(p, 2));
    }
    const input = new Float32Array(3 * SIZE * SIZE);
    for (let c = 0; c < 3; c++) {
      for (let p = 0; p < SIZE * SIZE; p++) {
        input[c * SIZE * SIZE + p] = (at(p, c) / max - MEAN[c]) / STD[c];
      }
    }

    const {Tensor} = ort();
    const output = await model.run({
      [model.inputNames[0]]: new Tensor('float32', input, [1, 3, SIZE, SIZE]),
    });
    const values = output[model.outputNames[0]].data as Float32Array;
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of values) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    if (!(hi - lo > 1e-6)) {
      return null;
    }
    // Bytes, stretched to the full range, as base64 for the WebView.
    const mask = new Uint8Array(values.length);
    for (let i = 0; i < values.length; i++) {
      mask[i] = Math.round(((values[i] - lo) / (hi - lo)) * 255);
    }
    return toBase64(mask);
  } catch (e) {
    if (__DEV__) {
      console.warn('Garment mask unavailable, using the flood-fill:', e);
    }
    return null;
  }
}

const BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 of raw bytes (the mask is binary, not text). */
/* eslint-disable no-bitwise */
function toBase64(bytes: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out.push(
      BASE64[(n >> 18) & 63],
      BASE64[(n >> 12) & 63],
      i + 1 < bytes.length ? BASE64[(n >> 6) & 63] : '=',
      i + 2 < bytes.length ? BASE64[n & 63] : '=',
    );
  }
  return out.join('');
}
