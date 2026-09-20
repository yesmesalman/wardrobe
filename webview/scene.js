/* eslint-env browser */
/* eslint-disable no-bitwise */
/**
 * 3D garment scene that runs inside the app's WebView.
 *
 * It renders one of the blank garment models (.glb) and shows the user's
 * photo on it in one of two modes:
 *   - "fit":   the garment cut out of the photo is projected over the whole
 *              model (front only; the back and sides use the fabric colour)
 *   - "print": the photo is a small decal on the chest / thigh
 *
 * React Native drives it through these globals:
 *   __setGarment({variant, photo, mode, align})  swap model / photo / mode
 *       variant: 'short-sleeve' | 'long-sleeve' | 'long-pants' | 'shorts'
 *   __setColor(hex)                           fabric colour
 *   __setAutoRotate(bool)
 *   __setView('3d' | 'align')                 3D view or 2D alignment view
 *   __setAlign({sx, sy, ox, oy}), __resetAlign()
 *   __processPhoto(id, dataUrl, removeBackground)  cut the garment out
 *   __snapshot(id)                            JPEG still for library cards
 * and reports back with window.ReactNativeWebView.postMessage.
 *
 * Bundled by scripts/build-webview.js into src/webview/sceneHtml.ts.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DecalGeometry} from 'three/examples/jsm/geometries/DecalGeometry.js';
import shirtModel from '../src/assets/models/blank_shirt.glb';
import longShirtModel from '../src/assets/models/blank_shirt_long.glb';
import pantsModel from '../src/assets/models/blank_pants.glb';
import shortsModel from '../src/assets/models/blank_shorts.glb';

// Blank models by variant (base64, embedded by the bundler).
const MODEL_DATA = {
  'short-sleeve': shirtModel,
  'long-sleeve': longShirtModel,
  'long-pants': pantsModel,
  shorts: shortsModel,
};

const BACKGROUND = 0xece7df;
const FOV = 30;
const SPIN_SPEED = 0.6; // radians per second
const DRAG_SPEED = 0.012; // radians per pixel
const SNAPSHOT = {width: 480, height: 600, yaw: 0.3};
const ALIGN_COLOR = '#9fb0c4'; // model colour while aligning the photo
const ANALYSIS_SIZE = 400; // px, longest side used to find the garment
const CUTOUT_SIZE = 800; // px, longest side of the stored cut-out
const DEFAULT_ALIGN = {sx: 1, sy: 1, ox: 0, oy: 0};

const post = message =>
  window.ReactNativeWebView &&
  window.ReactNativeWebView.postMessage(JSON.stringify(message));

window.addEventListener('error', e =>
  post({type: 'error', message: String(e.message)}),
);

// ---------------------------------------------------------------------------
// Renderer, lights, cameras
// ---------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true, // needed for canvas.toDataURL snapshots
});
const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
document.body.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(BACKGROUND);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8378, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.9);
key.position.set(2, 3, 4);
const rim = new THREE.DirectionalLight(0xffffff, 0.6);
rim.position.set(-3, 1, -2);
const fill = new THREE.DirectionalLight(0xffffff, 0.35);
fill.position.set(0, -2, 3);
scene.add(key, rim, fill);

const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 20);
// Front-on orthographic camera used to line the photo up with the model.
const alignCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
const alignView = {height: 1};

const spinner = new THREE.Group();
scene.add(spinner);

// The photo, drawn translucently over the model while aligning.
const alignPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.72,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
);
alignPlane.renderOrder = 10;
alignPlane.visible = false;
scene.add(alignPlane);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const loader = new GLTFLoader();
const models = {}; // variant -> {geometry, anchor, size, bbox}
const state = {
  variant: null,
  mode: 'fit',
  color: '#f2f0eb',
  autoRotate: true,
  view: '3d',
  align: {...DEFAULT_ALIGN},
  yaw: 0,
  dragging: false,
  // Guards against a slow load finishing after a newer request.
  request: 0,
};
let garment = null; // {group, material, uniforms, texture, model}
let size = {width: 1, height: 1};

function loadModel(variant) {
  if (models[variant]) {
    return Promise.resolve(models[variant]);
  }
  const base64 = MODEL_DATA[variant] || MODEL_DATA['short-sleeve'];
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new Promise((resolve, reject) =>
    loader.parse(
      bytes.buffer,
      '',
      gltf => {
        let mesh = null;
        gltf.scene.traverse(o => {
          mesh = mesh || (o.isMesh ? o : null);
        });
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox;
        const dims = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        models[variant] = {
          geometry: mesh.geometry,
          anchor: mesh.userData.decal,
          // Yaw changes the visible width, so frame the wider horizontal side.
          size: {width: Math.max(dims.x, dims.z), height: dims.y},
          // Front-on extent, used to fit a photo over the model.
          bbox: {cx: centre.x, cy: centre.y, W: dims.x, H: dims.y},
        };
        resolve(models[variant]);
      },
      reject,
    ),
  );
}

function loadTexture(dataUrl) {
  return new Promise((resolve, reject) =>
    new THREE.TextureLoader().load(
      dataUrl,
      texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        resolve(texture);
      },
      undefined,
      reject,
    ),
  );
}

/**
 * Fabric material that shows the photo over the model's front. The photo is
 * projected straight through the model along z, so UVs are computed in the
 * shader; it fades out on surfaces that face sideways or away so it does not
 * smear over the sleeves' sides and the back.
 */
function makeFitMaterial(color, texture, bbox) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const uniforms = {
    uPhoto: {value: texture},
    uAlign: {value: new THREE.Vector4(1, 1, 0, 0)},
    uBox: {value: new THREE.Vector4(bbox.cx, bbox.cy, bbox.W, bbox.H)},
    uMix: {value: 1},
  };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvObjPos = position;\nvObjNormal = normal;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uPhoto;
        uniform vec4 uAlign;
        uniform vec4 uBox;
        uniform float uMix;
        varying vec3 vObjPos;
        varying vec3 vObjNormal;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 puv = vec2(
          (vObjPos.x - uBox.x - uAlign.z * uBox.z) / (uAlign.x * uBox.z) + 0.5,
          (vObjPos.y - uBox.y - uAlign.w * uBox.w) / (uAlign.y * uBox.w) + 0.5
        );
        vec4 photo = texture2D(uPhoto, puv);
        float inside = step(0.0, puv.x) * step(puv.x, 1.0) * step(0.0, puv.y) * step(puv.y, 1.0);
        float facing = smoothstep(0.3, 0.75, vObjNormal.z) * (gl_FrontFacing ? 1.0 : 0.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, photo.rgb, photo.a * inside * facing * uMix);`,
      );
  };
  material.customProgramCacheKey = () => 'wardrobe-fit';
  return {material, uniforms};
}

function disposeGarment() {
  if (!garment) {
    return;
  }
  spinner.remove(garment.group);
  garment.group.traverse(o => {
    if (o.isMesh && o.geometry !== garment.model.geometry) {
      o.geometry.dispose();
    }
    if (o.material) {
      o.material.map && o.material.map.dispose();
      o.material.dispose();
    }
  });
  garment.texture && garment.texture.dispose();
  garment = null;
}

async function setGarment({variant, photo, mode, align}) {
  const request = ++state.request;
  try {
    const model = await loadModel(variant);
    const texture = photo ? await loadTexture(photo) : null;
    if (request !== state.request) {
      texture && texture.dispose();
      return;
    }
    disposeGarment();

    const fit = mode === 'fit' && texture;
    const group = new THREE.Group();
    let material;
    let uniforms = null;
    if (fit) {
      ({material, uniforms} = makeFitMaterial(
        state.color,
        texture,
        model.bbox,
      ));
    } else {
      material = new THREE.MeshStandardMaterial({
        color: state.color,
        roughness: 0.85,
        side: THREE.DoubleSide,
      });
    }
    const mesh = new THREE.Mesh(model.geometry, material);
    group.add(mesh);

    if (texture && !fit) {
      // Print mode: project the photo onto the garment's print area, keeping
      // its aspect ratio inside the anchor's square footprint.
      const {position, rotation, scale} = model.anchor;
      const aspect = texture.image.width / texture.image.height;
      const ratio = aspect >= 1 ? [1, 1 / aspect] : [aspect, 1];
      group.add(
        new THREE.Mesh(
          new DecalGeometry(
            mesh,
            new THREE.Vector3(...position),
            new THREE.Euler(...rotation),
            new THREE.Vector3(scale[0] * ratio[0], scale[1] * ratio[1], scale[2]),
          ),
          new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            roughness: 0.6,
            polygonOffset: true,
            polygonOffsetFactor: -4,
          }),
        ),
      );
    }

    spinner.add(group);
    garment = {
      group,
      material,
      uniforms,
      texture: fit ? texture : null,
      model,
    };
    size = model.size;
    state.variant = variant;
    state.mode = mode;
    state.align = {...DEFAULT_ALIGN, ...align};
    if (!uniforms) {
      state.view = '3d';
    }
    fitCamera();
    applyAlign();
    applyView();
    post({type: 'loaded'});
  } catch (e) {
    post({type: 'error', message: String(e && e.message ? e.message : e)});
  }
}

function setColor(hex) {
  state.color = hex;
  applyView();
}

// ---------------------------------------------------------------------------
// Alignment view
// ---------------------------------------------------------------------------

/** Pushes the photo alignment to the shader and the overlay plane. */
function applyAlign() {
  if (!garment) {
    return;
  }
  const {sx, sy, ox, oy} = state.align;
  const b = garment.model.bbox;
  if (garment.uniforms) {
    garment.uniforms.uAlign.value.set(sx, sy, ox, oy);
  }
  alignPlane.scale.set(sx * b.W, sy * b.H, 1);
  alignPlane.position.set(b.cx + ox * b.W, b.cy + oy * b.H, 1);
}

/** Shows the 3D view or the 2D alignment view. */
function applyView() {
  if (!garment) {
    return;
  }
  const aligning = state.view === 'align' && !!garment.uniforms;
  if (garment.uniforms) {
    garment.uniforms.uMix.value = aligning ? 0 : 1;
  }
  garment.material.color.set(aligning ? ALIGN_COLOR : state.color);
  alignPlane.visible = aligning;
  if (aligning) {
    alignPlane.material.map = garment.texture;
    alignPlane.material.needsUpdate = true;
    fitAlignCamera();
  }
}

function fitAlignCamera() {
  const aspect = (window.innerWidth || 1) / (window.innerHeight || 1);
  const b = garment ? garment.model.bbox : {cx: 0, cy: 0, W: 1, H: 1};
  const height = Math.max(b.H * 1.35, (b.W * 1.35) / aspect);
  alignView.height = height;
  alignCamera.left = (-height * aspect) / 2;
  alignCamera.right = (height * aspect) / 2;
  alignCamera.top = height / 2;
  alignCamera.bottom = -height / 2;
  alignCamera.position.set(b.cx, b.cy, 5);
  alignCamera.updateProjectionMatrix();
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function moveAlign(dx, dy) {
  if (!garment) {
    return;
  }
  const worldPerPixel = alignView.height / (window.innerHeight || 1);
  const b = garment.model.bbox;
  state.align.ox += (dx * worldPerPixel) / b.W;
  state.align.oy -= (dy * worldPerPixel) / b.H;
  applyAlign();
}

function scaleAlign(factor) {
  state.align.sx = clamp(state.align.sx * factor, 0.3, 3);
  state.align.sy = clamp(state.align.sy * factor, 0.3, 3);
  applyAlign();
}

// ---------------------------------------------------------------------------
// Framing, resizing and the render loop
// ---------------------------------------------------------------------------

/** Backs the perspective camera off until the whole garment fits. */
function fitCamera() {
  const half = Math.tan((FOV * Math.PI) / 360);
  const distance = Math.max(
    size.height / (2 * half),
    size.width / (2 * half * camera.aspect),
  );
  camera.position.set(0, 0, distance * 1.18);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function resize() {
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  fitCamera();
  fitAlignCamera();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now) {
  const delta = Math.min((now - last) / 1000, 0.1);
  last = now;
  const aligning = state.view === 'align' && garment && garment.uniforms;
  if (!aligning && state.autoRotate && !state.dragging) {
    state.yaw += delta * SPIN_SPEED;
  }
  spinner.rotation.y = aligning ? 0 : state.yaw;
  renderer.render(scene, aligning ? alignCamera : camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------------------
// Touch: drag to spin 360° (3D) or move / pinch the photo (alignment)
// ---------------------------------------------------------------------------

const pointers = new Map();
let pinchDistance = 0;
const currentPinch = () => {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};

canvas.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
  canvas.setPointerCapture(e.pointerId);
  state.dragging = true;
  if (pointers.size === 2) {
    pinchDistance = currentPinch();
  }
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p) {
    return;
  }
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (state.view === 'align') {
    if (pointers.size === 2) {
      const distance = currentPinch();
      if (pinchDistance > 0) {
        scaleAlign(distance / pinchDistance);
      }
      pinchDistance = distance;
      moveAlign(dx / 2, dy / 2);
    } else {
      moveAlign(dx, dy);
    }
  } else if (pointers.size === 1) {
    state.yaw += dx * DRAG_SPEED;
  }
});
const endDrag = e => {
  pointers.delete(e.pointerId);
  pinchDistance = 0;
  if (pointers.size === 0) {
    state.dragging = false;
    if (state.view === 'align') {
      post({type: 'align', align: state.align});
    }
  }
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---------------------------------------------------------------------------
// Cutting the garment out of a photo
// ---------------------------------------------------------------------------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read the photo.'));
    image.src = src;
  });
}

function drawScaled(image, maxSide) {
  const k = Math.min(1, maxSide / Math.max(image.width, image.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(image.width * k));
  c.height = Math.max(1, Math.round(image.height * k));
  const ctx = c.getContext('2d', {willReadFrequently: true});
  ctx.drawImage(image, 0, 0, c.width, c.height);
  return {canvas: c, ctx, w: c.width, h: c.height};
}

const toHex = ([r, g, b]) =>
  `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Most common colour (coarsely binned) among the pixels in `mask`. */
function dominantColour(data, w, h, mask) {
  const bins = new Map();
  for (let i = 0; i < w * h; i++) {
    if (mask && !mask[i]) {
      continue;
    }
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(k) || [0, 0, 0, 0];
    bin[0] += r;
    bin[1] += g;
    bin[2] += b;
    bin[3] += 1;
    bins.set(k, bin);
  }
  let best = null;
  bins.forEach(bin => {
    best = !best || bin[3] > best[3] ? bin : best;
  });
  return best
    ? toHex([best[0] / best[3], best[1] / best[3], best[2] / best[3]])
    : '#cccccc';
}

/** Colour and tolerance of the plain surface around the garment. */
function estimateBackground(data, w, h) {
  const samples = [];
  const add = (x, y) => {
    const i = (y * w + x) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let x = 0; x < w; x++) {
    add(x, 0);
    add(x, 1);
    add(x, h - 1);
    add(x, h - 2);
  }
  for (let y = 2; y < h - 2; y++) {
    add(0, y);
    add(1, y);
    add(w - 1, y);
    add(w - 2, y);
  }
  const median = c => {
    const v = samples.map(s => s[c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const rgb = [median(0), median(1), median(2)];
  const spread = samples
    .map(s => Math.hypot(s[0] - rgb[0], s[1] - rgb[1], s[2] - rgb[2]))
    .sort((a, b) => a - b);
  const p90 = spread[Math.floor(spread.length * 0.9)];
  return {rgb, tolerance: clamp(p90 * 1.5 + 12, 26, 60)};
}

/** Flood-fills the background inwards from the photo's border. */
function findBackground(data, w, h, bg) {
  const n = w * h;
  const isBackground = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const distance = i =>
    Math.hypot(
      data[i * 4] - bg.rgb[0],
      data[i * 4 + 1] - bg.rgb[1],
      data[i * 4 + 2] - bg.rgb[2],
    );
  const step = (i, j) =>
    Math.hypot(
      data[i * 4] - data[j * 4],
      data[i * 4 + 1] - data[j * 4 + 1],
      data[i * 4 + 2] - data[j * 4 + 2],
    );
  const push = i => {
    isBackground[i] = 1;
    queue[tail++] = i;
  };
  const seed = i => {
    if (!isBackground[i] && distance(i) < bg.tolerance) {
      push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i / w) | 0;
    const neighbours = [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < h - 1 ? i + w : -1,
    ];
    for (const j of neighbours) {
      if (j < 0 || isBackground[j]) {
        continue;
      }
      // Close to the background colour, or a smooth shading change (soft
      // shadows, lighting gradients) leading away from it.
      const d = distance(j);
      if (d < bg.tolerance || (d < bg.tolerance * 3 && step(i, j) < 8)) {
        push(j);
      }
    }
  }
  return isBackground;
}

/** Garment mask: the largest non-background blob, eroded by two pixels. */
function garmentMask(isBackground, w, h) {
  const n = w * h;
  const label = new Int32Array(n);
  const queue = new Int32Array(n);
  const sizes = [0];
  let best = 0;
  for (let start = 0; start < n; start++) {
    if (isBackground[start] || label[start]) {
      continue;
    }
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    label[start] = id;
    queue[tail++] = start;
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      const y = (i / w) | 0;
      const neighbours = [
        x > 0 ? i - 1 : -1,
        x < w - 1 ? i + 1 : -1,
        y > 0 ? i - w : -1,
        y < h - 1 ? i + w : -1,
      ];
      for (const j of neighbours) {
        if (j >= 0 && !isBackground[j] && !label[j]) {
          label[j] = id;
          queue[tail++] = j;
        }
      }
    }
    sizes.push(tail);
    if (tail > (sizes[best] || 0)) {
      best = id;
    }
  }
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    mask[i] = label[i] === best ? 1 : 0;
  }
  // Pull the edge in so its soft, scaled-up border only blends garment pixels
  // and never the background colour.
  return erode(erode(mask, w, h), w, h);
}

/** Removes one pixel from the edge of a mask (4-neighbourhood). */
function erode(mask, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      out[i] =
        mask[i] && mask[i - 1] && mask[i + 1] && mask[i - w] && mask[i + w]
          ? 1
          : 0;
    }
  }
  return out;
}

function wholePhoto(image) {
  const {ctx, w, h} = drawScaled(image, ANALYSIS_SIZE);
  const data = ctx.getImageData(0, 0, w, h).data;
  const out = drawScaled(image, CUTOUT_SIZE);
  return {
    data: out.canvas.toDataURL('image/png'),
    color: dominantColour(data, w, h, null),
    removed: false,
  };
}

/** Cuts the garment out of the photo and crops to its outline. */
function cutOut(image) {
  const {ctx, w, h} = drawScaled(image, ANALYSIS_SIZE);
  const data = ctx.getImageData(0, 0, w, h).data;
  const isBackground = findBackground(data, w, h, estimateBackground(data, w, h));
  const mask = garmentMask(isBackground, w, h);

  let count = 0;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        count++;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  const coverage = count / (w * h);
  // Nothing found, or almost the whole photo: the background was not plain.
  if (coverage < 0.05 || coverage > 0.95) {
    return null;
  }

  // Soft-edged mask at analysis size, scaled up when it is applied.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext('2d');
  const maskData = maskCtx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    maskData.data[i * 4 + 3] = mask[i] ? 255 : 0;
  }
  maskCtx.putImageData(maskData, 0, 0);

  // Crop box in source pixels.
  const sx = (x0 / w) * image.width;
  const sy = (y0 / h) * image.height;
  const sw = ((x1 - x0 + 1) / w) * image.width;
  const sh = ((y1 - y0 + 1) / h) * image.height;
  const k = Math.min(1, CUTOUT_SIZE / Math.max(sw, sh));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(sw * k));
  out.height = Math.max(1, Math.round(sh * k));
  const outCtx = out.getContext('2d');
  outCtx.drawImage(image, sx, sy, sw, sh, 0, 0, out.width, out.height);
  outCtx.globalCompositeOperation = 'destination-in';
  outCtx.imageSmoothingEnabled = true;
  outCtx.drawImage(
    maskCanvas,
    x0,
    y0,
    x1 - x0 + 1,
    y1 - y0 + 1,
    0,
    0,
    out.width,
    out.height,
  );
  return {
    data: out.toDataURL('image/png'),
    color: dominantColour(data, w, h, mask),
    removed: true,
  };
}

async function processPhoto(id, dataUrl, removeBackground) {
  try {
    const image = await loadImage(dataUrl);
    const result =
      (removeBackground && cutOut(image)) || wholePhoto(image);
    post({
      type: 'cutout',
      id,
      data: result.data,
      color: result.color,
      removed: result.removed,
    });
  } catch (e) {
    post({
      type: 'cutoutError',
      id,
      message: String(e && e.message ? e.message : e),
    });
  }
}

// ---------------------------------------------------------------------------
// Snapshot and the API for React Native
// ---------------------------------------------------------------------------

/** Renders one still frame at a fixed size and pose for the library cards. */
function snapshot(id) {
  try {
    if (state.view === 'align') {
      state.view = '3d';
      applyView();
      post({type: 'view', view: '3d'});
    }
    const previousYaw = spinner.rotation.y;
    renderer.setPixelRatio(1);
    renderer.setSize(SNAPSHOT.width, SNAPSHOT.height, false);
    camera.aspect = SNAPSHOT.width / SNAPSHOT.height;
    fitCamera();
    spinner.rotation.y = SNAPSHOT.yaw;
    renderer.render(scene, camera);
    const data = canvas.toDataURL('image/jpeg', 0.9);
    spinner.rotation.y = previousYaw;
    resize();
    post({type: 'snapshot', id, data});
  } catch (e) {
    resize();
    post({type: 'snapshotError', id, message: String(e)});
  }
}

window.__setGarment = setGarment;
window.__setColor = setColor;
window.__setAutoRotate = value => {
  state.autoRotate = value;
};
window.__setView = view => {
  state.view = view === 'align' && garment && garment.uniforms ? 'align' : '3d';
  applyView();
  post({type: 'view', view: state.view});
};
window.__setAlign = align => {
  state.align = {...DEFAULT_ALIGN, ...align};
  applyAlign();
};
window.__resetAlign = () => {
  state.align = {...DEFAULT_ALIGN};
  applyAlign();
  post({type: 'align', align: state.align});
};
window.__processPhoto = processPhoto;
window.__snapshot = snapshot;

post({type: 'ready'});
