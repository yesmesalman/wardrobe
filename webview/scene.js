/* eslint-env browser */
/**
 * 3D garment scene that runs inside the app's WebView.
 *
 * It renders one of the blank garment models (.glb) and projects the user's
 * photo onto it as a decal. React Native drives it through two globals:
 *   window.__setGarment({kind, photo})  - swap model / photo (data URL or null)
 *   window.__setColor(hex)              - fabric colour
 *   window.__setAutoRotate(bool)
 *   window.__snapshot(id)               - posts back a JPEG still of the garment
 * and it reports back with window.ReactNativeWebView.postMessage.
 *
 * Bundled by scripts/build-webview.js into src/webview/sceneHtml.ts.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DecalGeometry} from 'three/examples/jsm/geometries/DecalGeometry.js';
import shirtModel from '../src/assets/models/blank_shirt.glb';
import pantsModel from '../src/assets/models/blank_pants.glb';

const BACKGROUND = 0xece7df;
const FOV = 30;
const SPIN_SPEED = 0.6; // radians per second
const DRAG_SPEED = 0.012; // radians per pixel
const SNAPSHOT = {width: 480, height: 600, yaw: 0.35};

const post = message =>
  window.ReactNativeWebView &&
  window.ReactNativeWebView.postMessage(JSON.stringify(message));

window.addEventListener('error', e =>
  post({type: 'error', message: String(e.message)}),
);

// ---------------------------------------------------------------------------
// Renderer, lights, camera
// ---------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true, // needed for canvas.toDataURL snapshots
});
const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
document.body.appendChild(renderer.domElement);

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
const spinner = new THREE.Group();
scene.add(spinner);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const loader = new GLTFLoader();
const geometries = {}; // kind -> {mesh, size, anchor}
const state = {
  kind: null,
  photo: null,
  color: '#f2f0eb',
  autoRotate: true,
  yaw: 0,
  dragging: false,
  // Guards against a slow load finishing after a newer request.
  request: 0,
};
let garment = null; // {mesh, decal}
let size = {width: 1, height: 1};

function loadModel(kind) {
  if (geometries[kind]) {
    return Promise.resolve(geometries[kind]);
  }
  const base64 = kind === 'pants' ? pantsModel : shirtModel;
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
        geometries[kind] = {
          geometry: mesh.geometry,
          anchor: mesh.userData.decal,
          // Yaw changes the visible width, so frame the wider horizontal side.
          size: {width: Math.max(dims.x, dims.z), height: dims.y},
        };
        resolve(geometries[kind]);
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

function disposeGarment() {
  if (!garment) {
    return;
  }
  spinner.remove(garment.group);
  garment.group.traverse(o => {
    if (o.isMesh && o.geometry !== garment.sharedGeometry) {
      o.geometry.dispose();
    }
    if (o.material) {
      o.material.map && o.material.map.dispose();
      o.material.dispose();
    }
  });
  garment = null;
}

async function setGarment({kind, photo}) {
  const request = ++state.request;
  try {
    const model = await loadModel(kind);
    const texture = photo ? await loadTexture(photo) : null;
    if (request !== state.request) {
      texture && texture.dispose();
      return;
    }
    disposeGarment();

    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: state.color,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(model.geometry, material);
    group.add(mesh);

    if (texture) {
      // Project the photo onto the garment's print area, keeping its aspect
      // ratio inside the anchor's square footprint.
      const {position, rotation, scale} = model.anchor;
      const aspect = texture.image.width / texture.image.height;
      const fit = aspect >= 1 ? [1, 1 / aspect] : [aspect, 1];
      const decal = new THREE.Mesh(
        new DecalGeometry(
          mesh,
          new THREE.Vector3(...position),
          new THREE.Euler(...rotation),
          new THREE.Vector3(scale[0] * fit[0], scale[1] * fit[1], scale[2]),
        ),
        new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          roughness: 0.6,
          polygonOffset: true,
          polygonOffsetFactor: -4,
        }),
      );
      group.add(decal);
    }

    spinner.add(group);
    garment = {group, sharedGeometry: model.geometry};
    size = model.size;
    state.kind = kind;
    state.photo = photo;
    fitCamera();
    post({type: 'loaded'});
  } catch (e) {
    post({type: 'error', message: String(e && e.message ? e.message : e)});
  }
}

function setColor(hex) {
  state.color = hex;
  if (garment) {
    garment.group.children[0].material.color.set(hex);
  }
}

// ---------------------------------------------------------------------------
// Framing, resizing and the render loop
// ---------------------------------------------------------------------------

/** Backs the camera off until the whole garment fits the canvas. */
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
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now) {
  const delta = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (state.autoRotate && !state.dragging) {
    state.yaw += delta * SPIN_SPEED;
  }
  spinner.rotation.y = state.yaw;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------------------
// Touch: drag to spin 360°
// ---------------------------------------------------------------------------

let lastX = 0;
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', e => {
  state.dragging = true;
  lastX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (state.dragging) {
    state.yaw += (e.clientX - lastX) * DRAG_SPEED;
    lastX = e.clientX;
  }
});
const endDrag = () => {
  state.dragging = false;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---------------------------------------------------------------------------
// API for React Native
// ---------------------------------------------------------------------------

/** Renders one still frame at a fixed size and pose for the library cards. */
function snapshot(id) {
  try {
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
window.__snapshot = snapshot;

post({type: 'ready'});
