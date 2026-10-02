/* eslint-env browser */
/* eslint-disable no-bitwise */
/**
 * 3D garment scene that runs inside the app's WebView.
 *
 * It renders a standard blank garment (built by garmentGeometry.js) and shows
 * the user's photo on it in one of two modes:
 *   - "fit":   the garment is cut out of the photo, warped onto the model's
 *              shape and projected over its whole front (the back and sides
 *              use the fabric colour)
 *   - "print": the photo is a small decal on the chest / thigh
 *
 * React Native drives it through these globals:
 *   __setGarment({variant, body, photo, mode, align})  swap model / photo /
 *       mode
 *       variant: 'short-sleeve' | 'long-sleeve' | 'long-pants' | 'shorts'
 *       body:    'man' | 'woman' (the body type the models are cut for)
 *   __setColor(hex)                           fabric colour
 *   __setOutfit({shirt, pants})               show a shirt over pants, as if worn
 *       each: null or {id, variant, body, photo, mode, color, align, slide}
 *   __dragOutfit(part, px)                    move 'shirt' / 'pants' with a finger
 *   __releaseOutfit(part)                     let a dragged garment spring back
 *   __setSway(bool)                           sway gently while untouched
 *   __setView('3d' | 'align')                 3D view or 2D alignment view
 *   __setAlign({sx, sy, ox, oy}), __zoomAlign(factor), __resetAlign()
 *   __processPhoto(id, dataUrl, removeBackground, kind, aiMask, body)  cut
 *       the garment out (with the AI model's mask if given, else by
 *       flood-fill) and warp it onto each of the kind's models ('shirt' |
 *       'pants') for the body type
 *   __snapshot(id)                            JPEG still for library cards
 * and reports back with window.ReactNativeWebView.postMessage.
 *
 * Bundled by scripts/build-webview.js into src/webview/sceneHtml.ts.
 */
import * as THREE from 'three';
import {DecalGeometry} from 'three/examples/jsm/geometries/DecalGeometry.js';
import {buildGarment, shapesOf, shirtSide} from './garmentGeometry.js';

// The app can match its own screen colour by setting window.__BACKGROUND first.
const BACKGROUND = window.__BACKGROUND || '#ece7df';
const FOV = 30;
// The garment is only seen from the front; it tilts a little to look 3D.
const TILT = {
  yaw: 0.26, // furthest turn sideways (about 15 degrees)
  pitch: 0.14, // furthest tilt up or down (about 8 degrees)
  drag: 0.004, // radians per pixel dragged
  sway: 0.12, // gentle sway while untouched
  swaySeconds: 6, // one sway, left and back
  settle: 6, // how quickly it eases back after a drag
};
const SNAPSHOT = {width: 480, height: 600, yaw: 0.16};
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

const models = {}; // 'body:variant' -> {geometry, anchor, size, bbox, front}
const state = {
  variant: null,
  outfit: false,
  mode: 'fit',
  color: '#f2f0eb',
  sway: true,
  view: '3d',
  align: {...DEFAULT_ALIGN},
  yaw: 0,
  pitch: 0,
  swayTime: 0,
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

/** The standard blank garment for a variant and body type (built once). */
function buildModel(variant, body) {
  const id = `${body || 'man'}:${variant}`;
  if (!models[id]) {
    const {mesh, decal} = buildGarment(variant, body);
    const positions = new Float32Array(mesh.positions.flat());
    const indices = new Uint32Array(mesh.indices);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute(
      'normal',
      new THREE.BufferAttribute(new Float32Array(mesh.normals.flat()), 3),
    );
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
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
      // For drawing its silhouette (warping photos onto it).
      front: {positions, indices},
    };
  }
  return models[id];
}

const loadModel = (variant, body) => Promise.resolve(buildModel(variant, body));

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

// Light for the 2.5D shading, in view space: from the upper left, in front.
const SHADE_LIGHT = new THREE.Vector3(-0.35, 0.5, 0.8).normalize();

/**
 * Fabric material that shows the photo over the model's front, as a "2.5D"
 * picture: the photo is projected straight through the model along z (UVs are
 * computed in the shader) and covers the whole front silhouette, edge to edge.
 * It keeps the photo's own colours where the model faces the viewer and only
 * adds soft shading from the model's shape (darker where the surface turns
 * away), so the garment looks rounded without changing what the photo shows.
 * The garment is only ever seen from the front (it tilts a little), so the
 * fabric colour only fills gaps the photo doesn't cover.
 */
function makeFitMaterial(color, texture, bbox) {
  const uniforms = {
    uPhoto: {value: texture},
    uAlign: {value: new THREE.Vector4(1, 1, 0, 0)},
    uBox: {value: new THREE.Vector4(bbox.cx, bbox.cy, bbox.W, bbox.H)},
    uMix: {value: 1},
    uColor: {value: new THREE.Color(color)},
    uLight: {value: SHADE_LIGHT},
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec3 vObjPos;
      varying vec3 vNormal;
      void main() {
        vObjPos = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uPhoto;
      uniform vec4 uAlign;
      uniform vec4 uBox;
      uniform float uMix;
      uniform vec3 uColor;
      uniform vec3 uLight;
      varying vec3 vObjPos;
      varying vec3 vNormal;
      void main() {
        vec2 puv = vec2(
          (vObjPos.x - uBox.x - uAlign.z * uBox.z) / (uAlign.x * uBox.z) + 0.5,
          (vObjPos.y - uBox.y - uAlign.w * uBox.w) / (uAlign.y * uBox.w) + 0.5
        );
        vec4 photo = texture2D(uPhoto, puv);
        float inside = step(0.0, puv.x) * step(puv.x, 1.0) * step(0.0, puv.y) * step(puv.y, 1.0);
        vec3 base = mix(uColor, photo.rgb, photo.a * inside * uMix);
        vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        // 1.0 where the surface faces the viewer (the photo's own colours),
        // a little brighter towards the light, darker where it turns away.
        float shade = 0.6 + 0.5 * max(dot(n, uLight), 0.0);
        shade *= mix(0.78, 1.0, smoothstep(0.0, 0.45, n.z));
        gl_FragColor = vec4(base * shade, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return {material, uniforms};
}

/** Sets a garment's fabric colour. */
function setFabric(g, hex) {
  if (g.uniforms) {
    g.uniforms.uColor.value.set(hex);
  } else {
    g.material.color.set(hex);
  }
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

async function setGarment({variant, body, photo, mode, align}) {
  const request = ++state.request;
  try {
    const model = await loadModel(variant, body);
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

const outfitKey = spec => `${spec.id}:${spec.body || 'man'}`;

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
        // The same garment cut for another body type is a new one.
        if (outfit[part] && outfit[part].key === outfitKey(spec)) {
          return {part, keep: true};
        }
        return {
          part,
          spec,
          model: await loadModel(spec.variant, spec.body),
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
  setFabric(garment, aligning ? ALIGN_COLOR : state.color);
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
  if (!state.dragging) {
    // Ease back from a drag into the gentle sway (or to rest).
    let target = 0;
    if (state.sway) {
      state.swayTime += delta;
      target =
        TILT.sway * Math.sin((state.swayTime / TILT.swaySeconds) * Math.PI * 2);
    }
    const k = 1 - Math.exp(-delta * TILT.settle);
    state.yaw += (target - state.yaw) * k;
    state.pitch -= state.pitch * k;
  }
  const still = aligning || state.outfit;
  spinner.rotation.y = still ? 0 : state.yaw;
  spinner.rotation.x = still ? 0 : state.pitch;
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
// Touch: drag to tilt (3D) or move / pinch the photo (alignment)
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
    state.yaw = clamp(state.yaw + dx * TILT.drag, -TILT.yaw, TILT.yaw);
    state.pitch = clamp(state.pitch + dy * TILT.drag, -TILT.pitch, TILT.pitch);
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

/**
 * The AI model's mask (320×320 bytes, base64, from the app) as a background
 * map at analysis size: everything the model doesn't see as the garment.
 */
function aiBackground(aiMask, w, h) {
  const bytes = Uint8Array.from(atob(aiMask), c => c.charCodeAt(0));
  const N = Math.round(Math.sqrt(bytes.length));
  const at = (x, y) => bytes[clamp(y, 0, N - 1) * N + clamp(x, 0, N - 1)];
  const isBackground = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = ((y + 0.5) * N) / h - 0.5;
    const y0 = Math.floor(sy);
    const ty = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = ((x + 0.5) * N) / w - 0.5;
      const x0 = Math.floor(sx);
      const tx = sx - x0;
      const v = lerp(
        lerp(at(x0, y0), at(x0 + 1, y0), tx),
        lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx),
        ty,
      );
      isBackground[y * w + x] = v < 128 ? 1 : 0;
    }
  }
  return isBackground;
}

/**
 * Cuts the garment out of the photo and crops to its outline. The garment is
 * found by the AI model's mask when the app sends one, and otherwise (or if
 * that finds nothing usable) by flood-filling the plain background from the
 * photo's border.
 */
function cutOut(image, aiMask) {
  const {ctx, w, h} = drawScaled(image, ANALYSIS_SIZE);
  const data = ctx.getImageData(0, 0, w, h).data;
  const methods = [
    aiMask && ['ai', () => aiBackground(aiMask, w, h)],
    [
      'flood',
      () => findBackground(data, w, h, estimateBackground(data, w, h)),
    ],
  ].filter(Boolean);
  for (const [method, background] of methods) {
    const found = garmentFrom(image, data, w, h, background());
    if (found) {
      return {...found, method};
    }
  }
  return null;
}

/** The garment's cut-out from a background map, or null if none was found. */
function garmentFrom(image, data, w, h, isBackground) {
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
    // `photo`: its edges are the photo's, which can cut a garment off.
    outline: {mask, w, h, box: {x0, y0, x1, y1}, photo: true},
  };
}

// ---------------------------------------------------------------------------
// Measuring garments and warping photos onto the standard models
// ---------------------------------------------------------------------------
//
// Every garment of a variant uses the same standard model, so the photo is
// fitted to the model rather than the other way round. The garment's outline
// in the photo and the model's own front silhouette are measured the same way
// (body, sleeves; or waist, crotch, legs), and the photo is warped so each
// part lands on the matching part of the model.

const VARIANTS_OF = {
  shirt: ['short-sleeve', 'long-sleeve'],
  pants: ['long-pants', 'shorts'],
};

const median = values => {
  const v = [...values].sort((a, b) => a - b);
  return v.length ? v[v.length >> 1] : NaN;
};
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = t => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

/** Values of `fn(y)` over the rows from fraction `from` to `to` of the box. */
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
 * A flat-lay shirt's landmarks, in pixels of its outline: the body's centre
 * line, hem and top, and a scale `k` (pixels per unit) that makes the body as
 * wide as the standard model's. In those units (u outwards from the centre,
 * v up from the hem): the length, and for each sleeve its root (below the
 * shoulder point), angle below horizontal and reach to the cuff.
 */
function measureShirt(outline, shirt) {
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
  const k = bodyWidth / (2 * shirt.hemHalf);
  const length = height / k;

  // Garment pixels clear of the body's sides (so a hem that flares a little
  // isn't taken for a sleeve), in units, u outwards.
  const sleeve = side => {
    const points = [];
    const beyond = bodyWidth / 2 + Math.max(2, 0.03 * k);
    let cut = false;
    for (let y = box.y0; y <= outline.box.y1; y++) {
      for (let x = box.x0; x <= box.x1; x++) {
        if (mask[y * w + x] && side * (x - cx) > beyond) {
          points.push([(side * (x - cx)) / k, (hem - y) / k]);
          cut =
            cut ||
            (outline.photo &&
              (x === 0 || x === w - 1 || y === 0 || y === outline.h - 1));
        }
      }
    }
    // A sleeve running off the edge of the photo can't be measured.
    if (cut) {
      return null;
    }
    // Too few to be a sleeve (a sleeveless top, or a crease at the side).
    if (points.length < 0.002 * bodyWidth * height) {
      return null;
    }
    let angle = shirt.sleeveAngle * (Math.PI / 180);
    let root = null;
    let reach = 0;
    // Refine the sleeve's axis: from its root to the middle of its cuff.
    for (let pass = 0; pass < 3; pass++) {
      root = sleeveRoot(shirt, length, angle);
      const dir = [Math.cos(angle), -Math.sin(angle)];
      const along = points.map(
        ([u, v]) => (u - root[0]) * dir[0] + (v - root[1]) * dir[1],
      );
      reach = along.reduce((m, a) => Math.max(m, a), -Infinity);
      let su = 0;
      let sv = 0;
      let n = 0;
      points.forEach(([u, v], i) => {
        if (along[i] >= 0.85 * reach) {
          su += u;
          sv += v;
          n++;
        }
      });
      if (!n || reach <= 0) {
        return null;
      }
      angle = Math.atan2(root[1] - sv / n, su / n - root[0]);
    }
    // A sleeve lying mostly over the body shows too little of itself to
    // judge its angle; an implausible one falls back to the standard angle.
    if (angle < 25 * (Math.PI / 180) || angle > 72 * (Math.PI / 180)) {
      angle = shirt.sleeveAngle * (Math.PI / 180);
    }
    root = sleeveRoot(shirt, length, angle);
    return {root, angle, reach};
  };
  const sleeves = {1: sleeve(1), [-1]: sleeve(-1)};
  const reaches = [sleeves[1], sleeves[-1]].filter(Boolean).map(s => s.reach);
  return {
    cx,
    hem,
    k,
    length,
    sleeves,
    variant:
      reaches.length && Math.max(...reaches) > shirt.longReach
        ? 'long-sleeve'
        : 'short-sleeve',
  };
}

/** Centre of a sleeve's root: below the shoulder point, square to its axis. */
function sleeveRoot(shirt, length, angle) {
  return [
    shirt.shoulderX - Math.sin(angle) * shirt.sleeveRadius,
    length - shirt.shoulderDrop - Math.cos(angle) * shirt.sleeveRadius,
  ];
}

/**
 * Flat-lay pants' landmarks, in pixels of their outline: the centre line,
 * waist (top) and a scale `k` that makes the waist as wide as the standard
 * model's. In those units, measured down from the waist: the length, the rise
 * (to the crotch), the half width at the crotch, and the legs' outer and
 * inner edges at the hem (from the centre line).
 */
function measurePants(outline, pants) {
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
  const k = waistWidth / (2 * pants.waistHalf);
  const length = height / k;
  const marks = {cx, top: box.y0, k, length};

  // The crotch: the first gap down the middle, below the waistband.
  for (let y = Math.round(box.y0 + 0.1 * height); y <= box.y1; y++) {
    const open = [-1, 0, 1].filter(d => !mask[y * w + cx + d]).length;
    if (open >= 2) {
      marks.rise = (y - box.y0) / k;
      const runs = runsInRow(outline, y - 1);
      if (runs.length) {
        marks.forkOuter =
          (cx - runs[0][0] + (runs[runs.length - 1][1] - cx)) / 2 / k;
      }
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
    // One run: the legs touch at the hem.
    const inner =
      runs.length > 1 ? Math.max(0, (cx - left[1] + (right[0] - cx)) / 2) : 0;
    return [outer, inner];
  });
  if (hems.length) {
    marks.hemOuter = median(hems.map(([outer]) => outer)) / k;
    marks.hemInner = median(hems.map(([, inner]) => inner)) / k;
  }
  // Legs running off the bottom of the photo are longer than they measure.
  const cutOff = outline.photo && box.y1 >= outline.h - 2;
  marks.variant =
    length > pants.longLength || cutOff ? 'long-pants' : 'shorts';
  return marks;
}

/**
 * A model's front silhouette as a mask, `scale` pixels per unit, covering
 * exactly its front-on extent (the area a fitted photo is projected over).
 */
function modelOutline(model, scale) {
  const {positions, indices} = model.front;
  const {cx, cy, W, H} = model.bbox;
  const w = Math.max(1, Math.round(W * scale));
  const h = Math.max(1, Math.round(H * scale));
  const sx = w / W;
  const sy = h / H;
  const mask = new Uint8Array(w * h);
  const X = i => (positions[i * 3] - (cx - W / 2)) * sx;
  const Y = i => (cy + H / 2 - positions[i * 3 + 1]) * sy;
  for (let f = 0; f < indices.length; f += 3) {
    const [a, b, c] = [indices[f], indices[f + 1], indices[f + 2]];
    const [ax, ay, bx, by, cxx, cyy] = [X(a), Y(a), X(b), Y(b), X(c), Y(c)];
    const d = (bx - ax) * (cyy - ay) - (by - ay) * (cxx - ax);
    if (Math.abs(d) < 1e-9) {
      continue;
    }
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cxx)));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cxx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cyy)));
    const y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by, cyy)));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const l1 = ((bx - px) * (cyy - py) - (by - py) * (cxx - px)) / d;
        const l2 = ((cxx - px) * (ay - py) - (cyy - py) * (ax - px)) / d;
        if (l1 >= -0.01 && l2 >= -0.01 && 1 - l1 - l2 >= -0.01) {
          mask[y * w + x] = 1;
        }
      }
    }
  }
  return {mask, w, h, box: {x0: 0, y0: 0, x1: w - 1, y1: h - 1}};
}

/**
 * Where a point of the model's outline (pixels) is found in the photo
 * (pixels of the photo's outline), for shirts: the body is stretched onto the
 * model's body, each sleeve is turned and stretched along its axis onto the
 * model's sleeve, and the two blend across the body's sides. The photo's body
 * is taken to have straight sides; a fitted model (a woman's waist) draws it
 * in to match.
 */
function shirtWarp(shirt, model, photo) {
  const sleevesOf = side => {
    const m = model.sleeves[side];
    if (!m) {
      return null;
    }
    // A sleeve the photo didn't show (or a sleeveless top) keeps the
    // model's sleeve where the photo's shoulder is.
    const p = photo.sleeves[side] || {
      root: sleeveRoot(shirt, photo.length, m.angle),
      angle: m.angle,
      reach: m.reach,
    };
    return {
      m,
      p,
      md: [Math.cos(m.angle), -Math.sin(m.angle)],
      mn: [Math.sin(m.angle), Math.cos(m.angle)],
      pd: [Math.cos(p.angle), -Math.sin(p.angle)],
      pn: [Math.sin(p.angle), Math.cos(p.angle)],
      stretch: p.reach / m.reach,
    };
  };
  const sleeves = {1: sleevesOf(1), [-1]: sleevesOf(-1)};
  const stretchY = photo.length / model.length;
  return (x, y) => {
    const u = (x - model.cx) / model.k;
    const v = (model.hem - y) / model.k;
    const side = u < 0 ? -1 : 1;
    let pu = (u * shirt.hemHalf) / shirtSide(shirt, v);
    let pv = v * stretchY;
    const s = sleeves[side];
    const blend = s
      ? smoothstep((side * u - shirt.halfWidth + 0.012) / 0.035)
      : 0;
    if (blend > 0) {
      const du = side * u - s.m.root[0];
      const dv = v - s.m.root[1];
      let a = du * s.md[0] + dv * s.md[1];
      const b = du * s.mn[0] + dv * s.mn[1];
      a = a > 0 ? a * s.stretch : a;
      const su = s.p.root[0] + s.pd[0] * a + s.pn[0] * b;
      const sv = s.p.root[1] + s.pd[1] * a + s.pn[1] * b;
      pu = lerp(pu, side * su, blend);
      pv = lerp(pv, sv, blend);
    }
    return [photo.cx + pu * photo.k, photo.hem - pv * photo.k];
  };
}

/**
 * The same for pants: waist to crotch, then each leg from the crotch to the
 * hem, stretched so the crotch, the legs' edges and the hem line up.
 */
function pantsWarp(model, photo) {
  const p = {
    ...photo,
    rise: photo.rise ?? (model.rise * photo.length) / model.length,
    forkOuter: photo.forkOuter ?? model.forkOuter,
    hemOuter: photo.hemOuter ?? model.hemOuter,
    hemInner: photo.hemInner ?? model.hemInner,
  };
  return (x, y) => {
    const u = (x - model.cx) / model.k;
    const d = (y - model.top) / model.k;
    let pu;
    let pd;
    if (d < model.rise) {
      const t = d / model.rise;
      pd = t * p.rise;
      pu = u * lerp(1, p.forkOuter / model.forkOuter, t);
    } else {
      const t = (d - model.rise) / (model.length - model.rise);
      pd = lerp(p.rise, p.length, t);
      const mi = model.hemInner * t;
      const mo = lerp(model.forkOuter, model.hemOuter, t);
      const pi = p.hemInner * t;
      const po = lerp(p.forkOuter, p.hemOuter, t);
      const across = mo - mi > 1e-6 ? (Math.abs(u) - mi) / (mo - mi) : 0;
      pu = Math.sign(u) * (pi + across * (po - pi));
    }
    return [p.cx + pu * p.k, p.top + pd * p.k];
  };
}

/** The landmarks of a variant's standard model for a body (measured once). */
const modelLandmarks = {};
function landmarksOf(variant, body) {
  const id = `${body || 'man'}:${variant}`;
  if (!modelLandmarks[id]) {
    const model = buildModel(variant, body);
    const scale = CUTOUT_SIZE / Math.max(model.bbox.W, model.bbox.H);
    const outline = modelOutline(model, scale);
    const {shirt, pants} = shapesOf(body);
    modelLandmarks[id] = {
      outline,
      marks: VARIANTS_OF.pants.includes(variant)
        ? measurePants(outline, pants)
        : measureShirt(outline, shirt),
    };
  }
  return modelLandmarks[id];
}

/**
 * Draws the photo's garment in the shape of a variant's standard model, as a
 * PNG covering the model's front-on extent. `photo` holds the photo's outline
 * and landmarks; `source` the photo's full-size pixels.
 */
function warpOnto(variant, body, photo, source) {
  const {outline: target, marks} = landmarksOf(variant, body);
  const warp = VARIANTS_OF.pants.includes(variant)
    ? pantsWarp(marks, photo.marks)
    : shirtWarp(shapesOf(body).shirt, marks, photo.marks);
  const {mask, w: mw, h: mh} = photo.outline;
  // Colours come from the photo as taken, before it was turned upright.
  const {back, w: ow, h: oh} = photo.turn;
  const fx = source.w / ow;
  const fy = source.h / oh;
  const out = document.createElement('canvas');
  out.width = target.w;
  out.height = target.h;
  const ctx = out.getContext('2d');
  const image = ctx.createImageData(target.w, target.h);
  const px = image.data;
  // Bilinear samples: the mask (soft edge) and the photo's colour.
  const maskAt = (x, y) => {
    const x0 = Math.floor(x - 0.5);
    const y0 = Math.floor(y - 0.5);
    const tx = x - 0.5 - x0;
    const ty = y - 0.5 - y0;
    const m = (xx, yy) =>
      xx < 0 || yy < 0 || xx >= mw || yy >= mh ? 0 : mask[yy * mw + xx];
    return lerp(
      lerp(m(x0, y0), m(x0 + 1, y0), tx),
      lerp(m(x0, y0 + 1), m(x0 + 1, y0 + 1), tx),
      ty,
    );
  };
  const colourAt = (x, y, c) => {
    const sx = clamp(x - 0.5, 0, source.w - 1);
    const sy = clamp(y - 0.5, 0, source.h - 1);
    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const x1 = Math.min(source.w - 1, x0 + 1);
    const y1 = Math.min(source.h - 1, y0 + 1);
    const tx = sx - x0;
    const ty = sy - y0;
    const d = source.data;
    const at = (xx, yy) => d[(yy * source.w + xx) * 4 + c];
    return lerp(
      lerp(at(x0, y0), at(x1, y0), tx),
      lerp(at(x0, y1), at(x1, y1), tx),
      ty,
    );
  };
  for (let y = 0; y < target.h; y++) {
    for (let x = 0; x < target.w; x++) {
      const [sx, sy] = warp(x + 0.5, y + 0.5);
      const alpha = maskAt(sx, sy);
      if (alpha <= 0) {
        continue;
      }
      const i = (y * target.w + x) * 4;
      const [ox, oy] = back(sx, sy);
      for (let c = 0; c < 3; c++) {
        px[i + c] = colourAt(ox * fx, oy * fy, c);
      }
      px[i + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return out.toDataURL('image/png');
}

/**
 * The outline turned by `turns` quarter turns clockwise, plus `back`, which
 * maps a point of the turned outline to the photo as taken.
 */
function turnOutline(outline, turns) {
  const {mask, w, h} = outline;
  const turned = turns % 2 ? {w: h, h: w} : {w, h};
  // Point of the turned outline -> point of the original (continuous pixels).
  const back = [
    (x, y) => [x, y],
    (x, y) => [y, h - x],
    (x, y) => [w - x, h - y],
    (x, y) => [w - y, x],
  ][turns];
  const out = new Uint8Array(turned.w * turned.h);
  let x0 = turned.w;
  let y0 = turned.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < turned.h; y++) {
    for (let x = 0; x < turned.w; x++) {
      const [ox, oy] = back(x + 0.5, y + 0.5);
      if (mask[Math.floor(oy) * w + Math.floor(ox)]) {
        out[y * turned.w + x] = 1;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  return {
    outline: {
      mask: out,
      w: turned.w,
      h: turned.h,
      box: {x0, y0, x1, y1},
      photo: outline.photo,
    },
    turn: {turns, back, w, h},
  };
}

/**
 * How much an outline looks like a variant's standard model: both stretched
 * to the same box, the share of the two silhouettes that overlaps. An upright
 * shirt is a "T" (wide across the shoulders, narrow at the hem) and pants a
 * long "Λ", so a garment lying sideways or upside down scores clearly lower.
 */
function shapeScore(variant, body, outline) {
  const {outline: target} = landmarksOf(variant, body);
  const {mask, w, box} = outline;
  const bw = box.x1 - box.x0 + 1;
  const bh = box.y1 - box.y0 + 1;
  const N = 64;
  let both = 0;
  let either = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N;
      const v = (j + 0.5) / N;
      const inModel =
        target.mask[Math.floor(v * target.h) * target.w + Math.floor(u * target.w)];
      const inPhoto =
        mask[(box.y0 + Math.floor(v * bh)) * w + box.x0 + Math.floor(u * bw)];
      both += inModel && inPhoto ? 1 : 0;
      either += inModel || inPhoto ? 1 : 0;
    }
  }
  return both / (either || 1);
}

/**
 * The garment turned upright and measured. People photograph garments lying
 * any way round (the phone held sideways), so each quarter turn is compared
 * with the kind's standard models, and the best one that can be measured is
 * kept.
 */
function uprightGarment(outline, kind, body) {
  const variants = VARIANTS_OF[kind] || VARIANTS_OF.shirt;
  const {shirt, pants} = shapesOf(body);
  const turns = [0, 1, 2, 3]
    .map(t => {
      const turned = turnOutline(outline, t);
      const score = Math.max(
        ...variants.map(variant => shapeScore(variant, body, turned.outline)),
      );
      return {...turned, score};
    })
    .sort((a, b) => b.score - a.score);
  for (const turned of turns) {
    let marks = null;
    try {
      marks =
        kind === 'pants'
          ? measurePants(turned.outline, pants)
          : measureShirt(turned.outline, shirt);
    } catch {
      marks = null;
    }
    if (marks) {
      if (kind !== 'pants') {
        // Short or long sleeves: whichever model the outline looks like.
        marks.variant = variants.reduce((a, b) =>
          shapeScore(b, body, turned.outline) >
          shapeScore(a, body, turned.outline)
            ? b
            : a,
        );
        marks.sleeves = plausibleSleeves(marks.sleeves, marks.variant, body);
      }
      return {...turned, marks};
    }
  }
  return null;
}

/**
 * Keeps sleeves whose reach suits the variant (a sleeve partly hidden, or
 * merged with something next to it, measures far too short or long); a
 * missing sleeve takes the other one's measurements, as garments are
 * symmetric.
 */
function plausibleSleeves(sleeves, variant, body) {
  const model = landmarksOf(variant, body).marks.sleeves[1].reach;
  const ok = s => s && s.reach > 0.5 * model && s.reach < 1.8 * model;
  const right = ok(sleeves[1]) ? sleeves[1] : null;
  const left = ok(sleeves[-1]) ? sleeves[-1] : null;
  return {1: right || left, [-1]: left || right};
}

/** The photo's full-size pixels. */
function sourcePixels(image) {
  const c = document.createElement('canvas');
  c.width = image.width;
  c.height = image.height;
  const ctx = c.getContext('2d', {willReadFrequently: true});
  ctx.drawImage(image, 0, 0);
  return {w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data};
}

/**
 * Cuts the garment out of the photo and draws it in the shape of each of the
 * kind's standard models, cut for the body type. Falls back to the plain
 * cut-out (or the whole photo) for every variant when the garment's outline or
 * landmarks can't be found.
 */
async function processPhoto(id, dataUrl, removeBackground, kind, aiMask, body) {
  try {
    const image = await loadImage(dataUrl);
    const variants = VARIANTS_OF[kind] || VARIANTS_OF.shirt;
    const result =
      (removeBackground && cutOut(image, aiMask)) || wholePhoto(image);
    // Without landmarks, the plain cut-out is used.
    const upright = result.outline
      ? uprightGarment(result.outline, kind, body)
      : null;
    const marks = upright ? upright.marks : null;
    const cutouts = {};
    if (upright) {
      const source = sourcePixels(image);
      variants.forEach(variant => {
        cutouts[variant] = warpOnto(variant, body, upright, source);
      });
    } else {
      variants.forEach(variant => {
        cutouts[variant] = result.data;
      });
    }
    post({
      type: 'cutout',
      id,
      cutouts,
      color: result.color,
      removed: result.removed,
      method: result.method || null,
      variant: marks ? marks.variant : null,
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
    const previous = spinner.rotation.clone();
    renderer.setPixelRatio(1);
    renderer.setSize(SNAPSHOT.width, SNAPSHOT.height, false);
    camera.aspect = SNAPSHOT.width / SNAPSHOT.height;
    fitCamera();
    spinner.rotation.set(0, SNAPSHOT.yaw, 0);
    renderer.render(scene, camera);
    const data = canvas.toDataURL('image/jpeg', 0.9);
    spinner.rotation.copy(previous);
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
window.__setSway = value => {
  state.sway = value;
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
