/* eslint-env browser */
/* eslint-disable no-bitwise */
/**
 * 3D garment scene that runs inside the app's WebView.
 *
 * It renders a blank garment (built by garmentGeometry.js, reshaped to match
 * the garment in the user's photo) and shows the photo on it in one of two
 * modes:
 *   - "fit":   the garment cut out of the photo is projected over the whole
 *              model (front only; the back and sides use the fabric colour)
 *   - "print": the photo is a small decal on the chest / thigh
 *
 * React Native drives it through these globals:
 *   __setGarment({variant, shape, photo, mode, align})  swap model / photo / mode
 *       variant: 'short-sleeve' | 'long-sleeve' | 'long-pants' | 'shorts'
 *       shape:   the garment's measured proportions, or null for the defaults
 *   __setColor(hex)                           fabric colour
 *   __setOutfit({shirt, pants})               show a shirt over pants, as if worn
 *       each: null or {id, variant, shape, photo, mode, color, align, slide}
 *   __dragOutfit(part, px)                    move 'shirt' / 'pants' with a finger
 *   __releaseOutfit(part)                     let a dragged garment spring back
 *   __setAutoRotate(bool)
 *   __setView('3d' | 'align')                 3D view or 2D alignment view
 *   __setAlign({sx, sy, ox, oy}), __zoomAlign(factor), __resetAlign()
 *   __processPhoto(id, dataUrl, removeBackground, kind)  cut the garment out
 *       and measure its shape ('shirt' | 'pants')
 *   __snapshot(id)                            JPEG still for library cards
 * and reports back with window.ReactNativeWebView.postMessage.
 *
 * Bundled by scripts/build-webview.js into src/webview/sceneHtml.ts.
 */
import * as THREE from 'three';
import {DecalGeometry} from 'three/examples/jsm/geometries/DecalGeometry.js';
import {buildGarment, PANTS, resolveShape, SHIRT} from './garmentGeometry.js';

// The app can match its own screen colour by setting window.__BACKGROUND first.
const BACKGROUND = window.__BACKGROUND || '#ece7df';
const FOV = 30;
const SPIN_SPEED = 0.6; // radians per second
const DRAG_SPEED = 0.012; // radians per pixel
const SNAPSHOT = {width: 480, height: 600, yaw: 0.3};
const ALIGN_COLOR = '#9fb0c4'; // model colour while aligning the photo
const ANALYSIS_SIZE = 400; // px, longest side used to find the garment
const CUTOUT_SIZE = 800; // px, longest side of the stored cut-out
const DEFAULT_ALIGN = {sx: 1, sy: 1, ox: 0, oy: 0};
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 4;

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
document.documentElement.style.background = BACKGROUND;
document.body.style.background = BACKGROUND;
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

const models = {}; // variant + shape -> {geometry, anchor, size, bbox}
const state = {
  variant: null,
  outfit: false,
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
const outfit = {shirt: null, pants: null}; // garments shown by __setOutfit
const transitions = []; // garments sliding in or out of the outfit
let size = {width: 1, height: 1};

// Outfit layout: the waist is y = 0, the shirt's hem overlaps the pants' top.
const outfitCam = {distance: 4, centre: 0, tDistance: 4, tCentre: 0, snap: true};
const OUTFIT = {
  overlap: 0.13,
  shirtHeight: 0.74,
  pantsHeight: 1.14,
  // Framing: the figure fills the height (with just enough air to keep the
  // pants clear of the tab bar's round + button) unless a wide long-sleeve
  // shirt needs the width; the camera glides when that changes. The shirt
  // takes at most about three-quarters of the screen width, leaving the edges
  // for the app's ‹ › arrows.
  heightMargin: 1.08,
  widthMargin: 1.3,
  defaultWidth: 0.9,
  // The pants are a little deeper than the shirt's hem; flatten them slightly
  // so the waistband stays tucked under the shirt.
  pantsDepth: 0.72,
  // Garments slide this far sideways, in this many ms, when swapped: far
  // enough for even a long-sleeve shirt at full width to leave the screen.
  slideDistance: 1.5,
  slideMs: 300,
  // A dragged garment that is let go without changing springs back this fast.
  returnMs: 220,
};

/** The blank garment for a variant, fitted to a measured shape (cached). */
function loadModel(variant, shape) {
  const id = `${variant}:${JSON.stringify(resolveShape(variant, shape))}`;
  if (!models[id]) {
    const {mesh, decal} = buildGarment(variant, shape);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(mesh.positions.flat()), 3),
    );
    geometry.setAttribute(
      'normal',
      new THREE.BufferAttribute(new Float32Array(mesh.normals.flat()), 3),
    );
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.indices), 1));
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const dims = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    models[id] = {
      geometry,
      anchor: decal,
      // Yaw changes the visible width, so frame the wider horizontal side.
      size: {width: Math.max(dims.x, dims.z), height: dims.y},
      // Front-on extent, used to fit a photo over the model.
      bbox: {cx: centre.x, cy: centre.y, W: dims.x, H: dims.y},
    };
  }
  return Promise.resolve(models[id]);
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

function disposeOf(g) {
  g.group.parent && g.group.parent.remove(g.group);
  g.group.traverse(o => {
    if (o.isMesh && o.geometry !== g.model.geometry) {
      o.geometry.dispose();
    }
    if (o.material) {
      o.material.map && o.material.map.dispose();
      o.material.dispose();
    }
  });
  g.texture && g.texture.dispose();
}

function disposeGarment() {
  if (garment) {
    disposeOf(garment);
    garment = null;
  }
}

/**
 * Jumps slides in progress to their end (removing garments that left): all of
 * them, or only those of one part of the outfit.
 */
function finishTransitions(part) {
  for (let i = transitions.length - 1; i >= 0; i--) {
    const t = transitions[i];
    if (!part || t.part === part) {
      transitions.splice(i, 1);
      t.g.group.position.x = t.to;
      t.done && t.done();
    }
  }
}

function slide(g, from, to, {part, done, duration = OUTFIT.slideMs} = {}) {
  g.group.position.x = from;
  transitions.push({
    g,
    part,
    from,
    to,
    done,
    start: performance.now(),
    duration,
  });
}

/** Advances slides; ease-out so a garment settles gently into place. */
function stepTransitions(now) {
  for (let i = transitions.length - 1; i >= 0; i--) {
    const t = transitions[i];
    const k = Math.min(1, (now - t.start) / t.duration);
    const eased = 1 - (1 - k) ** 3;
    t.g.group.position.x = t.from + (t.to - t.from) * eased;
    if (k >= 1) {
      transitions.splice(i, 1);
      t.done && t.done();
    }
  }
}

function disposeOutfit() {
  finishTransitions();
  ['shirt', 'pants'].forEach(part => {
    if (outfit[part]) {
      disposeOf(outfit[part]);
      outfit[part] = null;
    }
  });
}

/** Builds a garment (not yet added to the scene) from a model and a photo. */
function createGarment(model, texture, mode, color, align) {
  const fit = mode === 'fit' && texture;
  const group = new THREE.Group();
  let material;
  let uniforms = null;
  if (fit) {
    ({material, uniforms} = makeFitMaterial(color, texture, model.bbox));
    if (align) {
      uniforms.uAlign.value.set(align.sx, align.sy, align.ox, align.oy);
    }
  } else {
    material = new THREE.MeshStandardMaterial({
      color,
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
  return {group, material, uniforms, texture: fit ? texture : null, model};
}

async function setGarment({variant, shape, photo, mode, align}) {
  const request = ++state.request;
  try {
    const model = await loadModel(variant, shape);
    const texture = photo ? await loadTexture(photo) : null;
    if (request !== state.request) {
      texture && texture.dispose();
      return;
    }
    disposeGarment();
    disposeOutfit();
    state.outfit = false;

    garment = createGarment(model, texture, mode, state.color);
    spinner.add(garment.group);
    size = model.size;
    state.variant = variant;
    state.mode = mode;
    state.align = {...DEFAULT_ALIGN, ...align};
    if (!garment.uniforms) {
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

/** Identifies what an outfit garment shows, so an unchanged one is kept. */
const outfitKey = spec => `${spec.id}:${JSON.stringify(spec.shape || null)}`;

/**
 * Shows a shirt over pants at their natural positions, as if worn. Only the
 * parts whose garment changed are rebuilt. A changed part slides in from the
 * side given by its `slide` (1 = from the right, -1 = from the left) while the
 * old one slides out the other way.
 */
async function setOutfit(specs) {
  const request = ++state.request;
  try {
    const loaded = await Promise.all(
      ['shirt', 'pants'].map(async part => {
        const spec = specs[part];
        if (!spec) {
          return {part, spec: null};
        }
        if (outfit[part] && outfit[part].key === outfitKey(spec)) {
          return {part, keep: true};
        }
        return {
          part,
          spec,
          model: await loadModel(spec.variant, spec.shape),
          texture: spec.photo ? await loadTexture(spec.photo) : null,
        };
      }),
    );
    if (request !== state.request) {
      loaded.forEach(p => p.texture && p.texture.dispose());
      return;
    }
    disposeGarment();
    finishTransitions();
    if (!state.outfit) {
      outfitCam.snap = true;
    }
    state.outfit = true;
    state.view = '3d';
    alignPlane.visible = false;

    loaded.forEach(item => {
      const {part} = item;
      const old = outfit[part];
      if (item.keep) {
        // Left where a drag stopped (the change it asked for never came).
        const x = old.group.position.x;
        if (x) {
          slide(old, x, 0, {part, duration: OUTFIT.returnMs});
        }
        return;
      }
      if (!item.spec) {
        if (old) {
          disposeOf(old);
          outfit[part] = null;
        }
        return;
      }
      const g = createGarment(
        item.model,
        item.texture,
        item.spec.mode,
        item.spec.color,
        item.spec.align,
      );
      g.key = outfitKey(item.spec);
      const height = item.model.size.height;
      // Models are centred on their own bounding box; hang them from the waist.
      g.group.position.y =
        part === 'shirt' ? -OUTFIT.overlap + height / 2 : -height / 2;
      if (part === 'pants') {
        g.group.scale.z = OUTFIT.pantsDepth;
      }
      spinner.add(g.group);
      outfit[part] = g;

      const dir = Math.sign(item.spec.slide || 0);
      if (old && dir) {
        // Carry on from wherever a drag left the old garment, as one strip:
        // the new one follows a slide's width behind it, and the rest of the
        // way takes a matching share of the time.
        const from = old.group.position.x;
        const left = Math.abs(from + dir * OUTFIT.slideDistance);
        const duration =
          OUTFIT.slideMs * Math.max(0.4, left / OUTFIT.slideDistance);
        slide(old, from, -dir * OUTFIT.slideDistance, {
          part,
          duration,
          done: () => disposeOf(old),
        });
        slide(g, from + dir * OUTFIT.slideDistance, 0, {part, duration});
      } else if (old) {
        disposeOf(old);
      }
    });
    fitCamera();
    post({type: 'loaded'});
  } catch (e) {
    post({type: 'error', message: String(e && e.message ? e.message : e)});
  }
}

/** World units per screen pixel at the outfit's depth. */
function outfitPixel() {
  const half = Math.tan((FOV * Math.PI) / 360);
  const visible = 2 * half * outfitCam.distance * camera.aspect;
  return visible / (window.innerWidth || 1);
}

/**
 * Moves one garment of the outfit sideways with the user's finger, `px` screen
 * pixels from its place (no further than a slide, so the garment that follows
 * it in never has to back up).
 */
function dragOutfit(part, px) {
  const g = state.outfit && outfit[part];
  if (!g) {
    return;
  }
  finishTransitions(part);
  const x = px * outfitPixel();
  g.group.position.x = Math.max(
    -OUTFIT.slideDistance,
    Math.min(OUTFIT.slideDistance, x),
  );
}

/** Lets a dragged garment that did not change spring back into place. */
function releaseOutfit(part) {
  const g = state.outfit && outfit[part];
  if (!g || transitions.some(t => t.g === g)) {
    return;
  }
  const x = g.group.position.x;
  if (x) {
    slide(g, x, 0, {part, duration: OUTFIT.returnMs});
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
  state.align.sx = clamp(state.align.sx * factor, ZOOM_MIN, ZOOM_MAX);
  state.align.sy = clamp(state.align.sy * factor, ZOOM_MIN, ZOOM_MAX);
  applyAlign();
}

// ---------------------------------------------------------------------------
// Framing, resizing and the render loop
// ---------------------------------------------------------------------------

/** Backs the perspective camera off until the whole garment fits. */
function placeOutfitCamera() {
  camera.position.set(0, outfitCam.centre, outfitCam.distance);
  camera.lookAt(0, outfitCam.centre, 0);
  camera.updateProjectionMatrix();
}

function fitCamera() {
  const half = Math.tan((FOV * Math.PI) / 360);
  if (state.outfit) {
    const shirtHeight = outfit.shirt
      ? outfit.shirt.model.size.height
      : OUTFIT.shirtHeight;
    const pantsHeight = outfit.pants
      ? outfit.pants.model.size.height
      : OUTFIT.pantsHeight;
    const top = -OUTFIT.overlap + shirtHeight;
    const bottom = -pantsHeight;
    const width = outfit.shirt
      ? outfit.shirt.model.size.width
      : OUTFIT.defaultWidth;
    outfitCam.tCentre = (top + bottom) / 2;
    outfitCam.tDistance = Math.max(
      ((top - bottom) * OUTFIT.heightMargin) / (2 * half),
      (width * OUTFIT.widthMargin) / (2 * half * camera.aspect),
    );
    if (outfitCam.snap) {
      outfitCam.distance = outfitCam.tDistance;
      outfitCam.centre = outfitCam.tCentre;
      outfitCam.snap = false;
    }
    placeOutfitCamera();
    // Where the waist (y = 0) falls on screen once the camera has settled, so
    // the app can split its touch zones there.
    const screenY = y =>
      (1 - (y - outfitCam.tCentre) / (outfitCam.tDistance * half)) / 2;
    post({
      type: 'outfitLayout',
      split: screenY(0),
      // Where each garment's middle falls, as a fraction of the view's height.
      shirtCentre: screenY(-OUTFIT.overlap + shirtHeight / 2),
      pantsCentre: screenY(-pantsHeight / 2),
    });
    return;
  }
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
  outfitCam.snap = true;
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
  if (!aligning && !state.outfit && state.autoRotate && !state.dragging) {
    state.yaw += delta * SPIN_SPEED;
  }
  spinner.rotation.y = aligning || state.outfit ? 0 : state.yaw;
  stepTransitions(now);
  if (state.outfit) {
    const k = 1 - Math.exp(-delta * 9);
    outfitCam.distance += (outfitCam.tDistance - outfitCam.distance) * k;
    outfitCam.centre += (outfitCam.tCentre - outfitCam.centre) * k;
    placeOutfitCamera();
  }
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

/**
 * Peels the halo off the edge of a cut-out. Background removal leaves a thin
 * fringe of anti-aliased and shadowed pixels around the garment; on the 3D
 * model that fringe gets stretched into a light streak. A pixel on the edge
 * is removed when its colour is far from the garment colour just inside it,
 * and this repeats inwards until the edge is the garment itself.
 */
function peelFringe(mask, data, w, h) {
  const PEEL_DISTANCE = 55; // colour difference (0-441) that counts as halo
  const RADIUS = 12; // how far to look for the garment colour, in pixels
  const MAX_PASSES = 8;
  const FRINGE_DEPTH = 6; // the garment colour is measured this far inside

  // "Core": pixels safely inside the garment, past any fringe.
  let core = mask;
  for (let i = 0; i < FRINGE_DEPTH; i++) {
    core = erode(core, w, h);
  }
  // Integral images of the core's colour, to average it over a window.
  const stride = w + 1;
  const sum = [0, 1, 2].map(() => new Float64Array(stride * (h + 1)));
  const count = new Float64Array(stride * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = [0, 0, 0];
    let rowCount = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (core[i]) {
        rowSum[0] += data[i * 4];
        rowSum[1] += data[i * 4 + 1];
        rowSum[2] += data[i * 4 + 2];
        rowCount++;
      }
      const j = (y + 1) * stride + x + 1;
      const up = y * stride + x + 1;
      for (let c = 0; c < 3; c++) {
        sum[c][j] = sum[c][up] + rowSum[c];
      }
      count[j] = count[up] + rowCount;
    }
  }
  const window = (table, x, y) => {
    const x0 = Math.max(0, x - RADIUS);
    const x1 = Math.min(w, x + RADIUS + 1);
    const y0 = Math.max(0, y - RADIUS);
    const y1 = Math.min(h, y + RADIUS + 1);
    return (
      table[y1 * stride + x1] -
      table[y0 * stride + x1] -
      table[y1 * stride + x0] +
      table[y0 * stride + x0]
    );
  };

  const out = Uint8Array.from(mask);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const peel = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const onEdge =
          out[i] && (!out[i - 1] || !out[i + 1] || !out[i - w] || !out[i + w]);
        if (!onEdge) {
          continue;
        }
        const n = window(count, x, y);
        if (n < 20) {
          continue; // nothing to compare with (a thin part): keep it
        }
        const dr = data[i * 4] - window(sum[0], x, y) / n;
        const dg = data[i * 4 + 1] - window(sum[1], x, y) / n;
        const db = data[i * 4 + 2] - window(sum[2], x, y) / n;
        if (Math.hypot(dr, dg, db) > PEEL_DISTANCE) {
          peel.push(i);
        }
      }
    }
    if (peel.length === 0) {
      break;
    }
    peel.forEach(i => {
      out[i] = 0;
    });
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
  const mask = peelFringe(garmentMask(isBackground, w, h), data, w, h);

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
    outline: {mask, w, h, box: {x0, y0, x1, y1}},
  };
}

// ---------------------------------------------------------------------------
// Measuring the garment's shape from its outline
// ---------------------------------------------------------------------------

const median = values => {
  const v = [...values].sort((a, b) => a - b);
  return v.length ? v[v.length >> 1] : NaN;
};

/** Median of `fn(y)` over the rows from fraction `from` to `to` of the box. */
function overRows(box, from, to, fn) {
  const height = box.y1 - box.y0 + 1;
  const values = [];
  for (
    let y = Math.round(box.y0 + from * height);
    y <= Math.round(box.y0 + to * height);
    y++
  ) {
    const v = fn(y);
    v !== null && values.push(v);
  }
  return values;
}

/** Runs of garment pixels in a row, as [first, last] columns. */
function runsInRow({mask, w}, y) {
  const runs = [];
  let start = -1;
  for (let x = 0; x <= w; x++) {
    const on = x < w && mask[y * w + x];
    if (on && start < 0) {
      start = x;
    } else if (!on && start >= 0) {
      // Ignore specks (a loose thread, a speck of the background).
      x - start > 2 && runs.push([start, x - 1]);
      start = -1;
    }
  }
  return runs;
}

/**
 * A flat-lay shirt: its body is as wide as the model's, which sets the scale;
 * from that, its length and each sleeve's length and angle. Sleeves are
 * followed from the model's shoulder point to the end of the garment pixels
 * beyond the body's sides.
 */
function measureShirt(outline) {
  const {mask, w} = outline;
  // Measure to the hem in the middle: long sleeves may hang lower.
  const centreGuess = Math.round((outline.box.x0 + outline.box.x1) / 2);
  let hem = outline.box.y1;
  while (hem > outline.box.y0 && !mask[hem * w + centreGuess]) {
    hem--;
  }
  const box = {...outline.box, y1: hem};
  const height = box.y1 - box.y0 + 1;
  // The body's width near the hem, where the sleeves don't reach.
  const hemRuns = overRows(box, 0.85, 0.97, y => {
    const run = runsInRow(outline, y).find(
      ([a, b]) => a <= centreGuess && b >= centreGuess,
    );
    return run || null;
  });
  if (hemRuns.length < 3) {
    return null;
  }
  const bodyWidth = median(hemRuns.map(([a, b]) => b - a + 1));
  const cx = median(hemRuns.map(([a, b]) => (a + b) / 2));
  const k = bodyWidth / (2 * SHIRT.flatHalfWidth); // pixels per model unit
  const length = height / k;

  // Garment pixels beyond the body's sides, in model units: X outwards from
  // the centre, Y up from the hem.
  const sleeve = side => {
    const points = [];
    // Clear of the body's sides, so a hem that flares a little isn't taken
    // for a sleeve.
    const beyond = bodyWidth / 2 + Math.max(2, 0.03 * k);
    const yEnd = outline.box.y1;
    for (let y = box.y0; y <= yEnd; y++) {
      for (let x = box.x0; x <= box.x1; x++) {
        if (mask[y * w + x] && side * (x - cx) > beyond) {
          points.push([(side * (x - cx)) / k, (box.y1 - y) / k]);
        }
      }
    }
    // Too few to be a sleeve (a sleeveless top, or a crease at the side).
    if (points.length < 0.002 * bodyWidth * height) {
      return null;
    }
    const shoulder = [SHIRT.shoulderX, length - SHIRT.shoulderDrop];
    let angle = 46 * (Math.PI / 180);
    let reach = 0;
    // Refine the sleeve's axis: from its root to the middle of its cuff.
    for (let pass = 0; pass < 3; pass++) {
      const dir = [Math.cos(angle), -Math.sin(angle)];
      const up = [Math.sin(angle), Math.cos(angle)];
      const root = [
        shoulder[0] - up[0] * SHIRT.sleeveRadius,
        shoulder[1] - up[1] * SHIRT.sleeveRadius,
      ];
      const along = points.map(
        ([x, y]) => (x - root[0]) * dir[0] + (y - root[1]) * dir[1],
      );
      reach = along.reduce((m, v) => Math.max(m, v), -Infinity);
      let sx = 0;
      let sy = 0;
      let n = 0;
      points.forEach(([x, y], i) => {
        if (along[i] >= 0.85 * reach) {
          sx += x;
          sy += y;
          n++;
        }
      });
      if (!n || reach <= 0) {
        return null;
      }
      angle = Math.atan2(root[1] - sy / n, sx / n - root[0]);
    }
    return {sleeveLength: reach, sleeveAngle: angle / (Math.PI / 180)};
  };
  const sleeves = [sleeve(1), sleeve(-1)].filter(Boolean);
  const shape = {length};
  if (sleeves.length) {
    const mean = name =>
      sleeves.reduce((sum, s) => sum + s[name], 0) / sleeves.length;
    shape.sleeveLength = mean('sleeveLength');
    shape.sleeveAngle = mean('sleeveAngle');
  }
  return {
    shape,
    variant:
      shape.sleeveLength !== undefined && shape.sleeveLength > 0.38
        ? 'long-sleeve'
        : 'short-sleeve',
  };
}

/**
 * Flat-lay pants: the waist is as wide as the model's, which sets the scale;
 * from that, the length, the rise (waist to crotch) and the legs at the hem.
 */
function measurePants(outline) {
  const {mask, w, box} = outline;
  const height = box.y1 - box.y0 + 1;
  const waistRuns = overRows(box, 0.02, 0.08, y => {
    const runs = runsInRow(outline, y);
    return runs.length ? [runs[0][0], runs[runs.length - 1][1]] : null;
  });
  if (waistRuns.length < 2) {
    return null;
  }
  const waistWidth = median(waistRuns.map(([a, b]) => b - a + 1));
  const cx = Math.round(median(waistRuns.map(([a, b]) => (a + b) / 2)));
  const k = waistWidth / (2 * PANTS.waistHalf);
  const shape = {length: height / k};

  // The crotch: the first gap down the middle, below the waistband.
  for (let y = Math.round(box.y0 + 0.1 * height); y <= box.y1; y++) {
    const open = [-1, 0, 1].filter(d => !mask[y * w + cx + d]).length;
    if (open >= 2) {
      shape.rise = (y - box.y0) / k - PANTS.crotchGap;
      break;
    }
  }

  // The legs at the hem: the outermost runs a little above the bottom.
  const hems = overRows(box, 0.93, 0.97, y => {
    const runs = runsInRow(outline, y);
    if (!runs.length) {
      return null;
    }
    const left = runs[0];
    const right = runs[runs.length - 1];
    const outer = (cx - left[0] + (right[1] - cx)) / 2;
    // One run: the legs touch at the hem, each is half of it.
    const half =
      runs.length > 1
        ? (left[1] - left[0] + 1 + (right[1] - right[0] + 1)) / 4
        : outer / 2;
    return [outer, half];
  });
  if (hems.length) {
    shape.hemOuter = median(hems.map(([outer]) => outer)) / k - PANTS.hemFolds;
    shape.hemHalf = median(hems.map(([, half]) => half)) / k - PANTS.hemFolds;
  }
  return {
    shape,
    variant: shape.length > 0.92 ? 'long-pants' : 'shorts',
  };
}

async function processPhoto(id, dataUrl, removeBackground, kind) {
  try {
    const image = await loadImage(dataUrl);
    const result =
      (removeBackground && cutOut(image)) || wholePhoto(image);
    let measured = null;
    if (result.outline) {
      try {
        measured =
          kind === 'pants'
            ? measurePants(result.outline)
            : measureShirt(result.outline);
      } catch {
        measured = null; // keep the cut-out; the default shape is used
      }
    }
    post({
      type: 'cutout',
      id,
      data: result.data,
      color: result.color,
      removed: result.removed,
      shape: measured ? measured.shape : null,
      variant: measured ? measured.variant : null,
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
window.__setOutfit = setOutfit;
window.__dragOutfit = dragOutfit;
window.__releaseOutfit = releaseOutfit;
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
/** Zooms the photo over the model (from the app's +/- buttons). */
window.__zoomAlign = factor => {
  scaleAlign(factor);
  post({type: 'align', align: state.align});
};
window.__resetAlign = () => {
  state.align = {...DEFAULT_ALIGN};
  applyAlign();
  post({type: 'align', align: state.align});
};
window.__processPhoto = processPhoto;
window.__snapshot = snapshot;

post({type: 'ready'});
