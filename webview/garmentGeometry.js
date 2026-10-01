/**
 * Builds the blank 3D garments (short- and long-sleeve shirts, long pants and
 * shorts) as plain vertex arrays. The garments are lofted from smooth
 * cross-sections, so they are reproducible and dependency free.
 *
 * Each garment can be reshaped to match the one in the user's photo: a
 * `shape` (see SHAPES) sets its length, sleeves or legs. Without one, the
 * variant's default proportions are used.
 *
 * Shared by the 3D scene (webview/scene.js, which builds the garments at
 * runtime) and the camera's guide outline (src/components/GuidedCamera.tsx).
 * Plain CommonJS so both bundlers can read it.
 */

// ---------------------------------------------------------------------------
// Small math helpers
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const smoothstep = t => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

/** Smoothly interpolates keyframes of the form [t, ...values]. */
function profile(keys, t) {
  if (t <= keys[0][0]) {
    return keys[0].slice(1);
  }
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, ...a] = keys[i];
    const [t1, ...b] = keys[i + 1];
    if (t <= t1) {
      const k = smoothstep((t - t0) / (t1 - t0));
      return a.map((v, j) => v + (b[j] - v) * k);
    }
  }
  return keys[keys.length - 1].slice(1);
}

/** Point on a super-ellipse (rounded box) cross-section. */
function superEllipse(theta, a, b, n = 2.4) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const e = 2 / n;
  return [
    a * Math.sign(c) * Math.abs(c) ** e,
    b * Math.sign(s) * Math.abs(s) ** e,
  ];
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = v => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

// ---------------------------------------------------------------------------
// Shapes: what can be fitted to a photo, with defaults and limits
// ---------------------------------------------------------------------------

/**
 * Model proportions the photo is measured against. All lengths are in model
 * units; the shirt body is 2 × SHIRT.halfWidth wide and the pants' waist
 * 2 × PANTS.waistHalf, and those stay fixed (so a shirt always covers the
 * pants' waistband in the Outfit). Everything else scales with the photo.
 */
const SHIRT = {
  halfWidth: 0.22,
  // The body's half width as it looks from the front: its folds make it a
  // little wider. Photos are measured against this.
  flatHalfWidth: 0.224,
  // Shoulder point: x from the centre, and how far below the collar's top.
  shoulderX: 0.256,
  shoulderDrop: 0.0858,
  shoulderSlope: 0.49, // about 26 degrees
  sleeveRadius: 0.086,
};
const PANTS = {
  waistHalf: 0.198,
  // As they look from the front: the legs overlap a little below the fork
  // before they part, and the wrinkles at the hem widen each leg.
  crotchGap: 0.041,
  hemFolds: 0.006,
};

/**
 * Per variant: the default shape and the range each value is held to.
 *  shirts: length (collar to hem), sleeveLength, sleeveAngle (degrees below
 *          horizontal)
 *  pants:  length (waist to hem), rise (waist to crotch), hemOuter (from the
 *          centre to a leg's outer edge at the hem), hemHalf (half a leg's
 *          width at the hem)
 */
const SHAPES = {
  'short-sleeve': {
    defaults: {length: 0.725, sleeveLength: 0.19, sleeveAngle: 46},
    limits: {
      length: [0.55, 0.95],
      sleeveLength: [0.1, 0.34],
      sleeveAngle: [30, 65],
    },
  },
  'long-sleeve': {
    defaults: {length: 0.725, sleeveLength: 0.6, sleeveAngle: 46},
    limits: {
      length: [0.55, 0.95],
      sleeveLength: [0.4, 0.75],
      sleeveAngle: [30, 65],
    },
  },
  'long-pants': {
    defaults: {length: 1.14, rise: 0.34, hemOuter: 0.172, hemHalf: 0.051},
    limits: {
      length: [0.9, 1.45],
      rise: [0.24, 0.44],
      hemOuter: [0.11, 0.27],
      hemHalf: [0.04, 0.11],
    },
  },
  shorts: {
    defaults: {length: 0.7, rise: 0.34, hemOuter: 0.204, hemHalf: 0.092},
    limits: {
      length: [0.46, 0.88],
      rise: [0.24, 0.44],
      hemOuter: [0.15, 0.27],
      hemHalf: [0.07, 0.13],
    },
  },
};

/**
 * The shape a garment is built with: the measured `shape` (if any) held to the
 * variant's limits, with defaults for anything missing.
 */
function resolveShape(variant, shape) {
  const spec = SHAPES[variant] || SHAPES['short-sleeve'];
  const out = {};
  Object.keys(spec.defaults).forEach(key => {
    const value = shape && Number.isFinite(shape[key]) ? shape[key] : null;
    const [min, max] = spec.limits[key];
    out[key] = value === null ? spec.defaults[key] : clamp(value, min, max);
  });
  if ('rise' in out) {
    // Legs keep some length below the crotch; legs don't cross at the hem.
    out.rise = Math.min(out.rise, out.length - 0.2);
    out.hemOuter = Math.max(out.hemOuter, 2 * out.hemHalf + 0.006);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mesh building
// ---------------------------------------------------------------------------

class Mesh {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.indices = [];
  }

  /**
   * Adds a surface lofted through `rows` (each row is a closed ring of [x,y,z]
   * points, all rows with the same point count). Normals are smoothed and
   * oriented away from the loft's centre line.
   */
  addLoft(rows, {closedRows = false} = {}) {
    const base = this.positions.length;
    const rowCount = rows.length;
    const ringSize = rows[0].length;
    const verts = rows.flat();
    const idx = [];
    const lastRow = closedRows ? rowCount : rowCount - 1;
    for (let r = 0; r < lastRow; r++) {
      const r2 = (r + 1) % rowCount;
      for (let i = 0; i < ringSize; i++) {
        const i2 = (i + 1) % ringSize;
        const a = r * ringSize + i;
        const b = r * ringSize + i2;
        const c = r2 * ringSize + i;
        const d = r2 * ringSize + i2;
        idx.push(a, b, c, b, d, c);
      }
    }

    // Accumulate area weighted face normals.
    const normals = verts.map(() => [0, 0, 0]);
    let outward = 0;
    const centres = rows.map(row => {
      const s = [0, 0, 0];
      row.forEach(p => {
        s[0] += p[0];
        s[1] += p[1];
        s[2] += p[2];
      });
      return s.map(v => v / row.length);
    });
    for (let f = 0; f < idx.length; f += 3) {
      const [a, b, c] = [idx[f], idx[f + 1], idx[f + 2]];
      const n = cross(sub(verts[b], verts[a]), sub(verts[c], verts[a]));
      [a, b, c].forEach(v => {
        normals[v][0] += n[0];
        normals[v][1] += n[1];
        normals[v][2] += n[2];
      });
      const centre = centres[Math.floor(a / ringSize)];
      const out = sub(verts[a], centre);
      outward += n[0] * out[0] + n[1] * out[1] + n[2] * out[2];
    }

    // Flip winding when the loft was built "inside out".
    const flip = outward < 0;
    for (let f = 0; f < idx.length; f += 3) {
      this.indices.push(
        base + idx[f],
        base + idx[f + (flip ? 2 : 1)],
        base + idx[f + (flip ? 1 : 2)],
      );
    }
    verts.forEach((p, i) => {
      const n = normalize(normals[i]);
      this.positions.push(p);
      this.normals.push(flip ? [-n[0], -n[1], -n[2]] : n);
    });
  }

  /** Translates everything so the bounding box is centred on the origin. */
  center() {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    this.positions.forEach(p =>
      p.forEach((v, i) => {
        min[i] = Math.min(min[i], v);
        max[i] = Math.max(max[i], v);
      }),
    );
    const mid = min.map((v, i) => (v + max[i]) / 2);
    this.positions = this.positions.map(p => sub(p, mid));
    return mid;
  }
}

/** A tube that follows a closed path, used for collars and cuffs. */
function ringTube(points, radius, segments = 8) {
  const centre = points
    .reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0])
    .map(v => v / points.length);
  return points.map(p => {
    const out = normalize([p[0] - centre[0], 0, p[2] - centre[2]]);
    const ring = [];
    for (let k = 0; k < segments; k++) {
      const phi = (k / segments) * TAU;
      const ox = Math.cos(phi) * radius;
      const oy = Math.sin(phi) * radius;
      ring.push([p[0] + out[0] * ox, p[1] + oy, p[2] + out[2] * ox]);
    }
    return ring;
  });
}

// ---------------------------------------------------------------------------
// Shirt
// ---------------------------------------------------------------------------

/**
 * Where a shirt's sleeve sits: the shoulder point (the sleeve's top edge
 * passes through it), the sleeve's direction and its "up" side.
 */
function sleeveFrame(shape) {
  const shoulder = [SHIRT.shoulderX, shape.length - SHIRT.shoulderDrop];
  const tilt = shape.sleeveAngle * DEG;
  return {
    shoulder,
    dir: [Math.cos(tilt), -Math.sin(tilt)],
    up: [Math.sin(tilt), Math.cos(tilt)],
  };
}

/**
 * Short-sleeve tee, or a long-sleeve shirt with sleeves angled down to the
 * cuff. A flat-lay tee: a boxy body with straight sides, shoulders on one
 * straight line sloping from the collar to the shoulder point, sleeves
 * hanging from it with a natural gap under the arm.
 */
function buildShirt(variant = 'short-sleeve', measured = null) {
  const long = variant === 'long-sleeve';
  const shape = resolveShape(long ? 'long-sleeve' : 'short-sleeve', measured);
  const mesh = new Mesh();
  const RING = 72;
  const ROWS = 80;
  const TOP = shape.length;
  // Everything from the chest up moves with the collar.
  const lift = TOP - SHAPES['short-sleeve'].defaults.length;

  const {shoulder, dir, up} = sleeveFrame(shape);
  const SLOPE = SHIRT.shoulderSlope;
  const seamY = x => shoulder[1] + (shoulder[0] - x) * SLOPE;
  const seamX = y => shoulder[0] - (y - shoulder[1]) / SLOPE;

  // [y, half width, half depth]. A boxy tee: straight sides from the hem up
  // to the armpit; above that the width follows the shoulder line. The body
  // is a little wider than the pants' waist, which it covers in the Outfit
  // view (the hem hangs 0.13 below the waistband there).
  const w = SHIRT.halfWidth;
  const torso = [
    [0.0, w, 0.096],
    [0.42 + lift, w, 0.098],
    [0.64 + lift, w + 0.005, 0.098],
    [0.667 + lift, w + 0.005, 0.092],
    [0.685 + lift, w + 0.005, 0.078],
    [0.712 + lift, w + 0.005, 0.064],
    [TOP, 0.09, 0.06],
  ];
  const neckStart = 0.6 + lift;

  const torsoRows = [];
  for (let r = 0; r < ROWS; r++) {
    const y = (r / (ROWS - 1)) * TOP;
    const [pw, d] = profile(torso, y);
    const width = Math.min(pw, Math.max(0.09, seamX(y)));
    const neckBlend = smoothstep((y - neckStart) / (TOP - neckStart));
    const ring = [];
    for (let i = 0; i < RING; i++) {
      const theta = (i / RING) * TAU;
      let [x, z] = superEllipse(theta, width, d);
      // Soft fabric folds, strongest near the hem.
      const fold =
        0.006 *
        (Math.sin(11 * theta + 6 * y) +
          0.6 * Math.sin(17 * theta - 9 * y + 1.3)) *
        (0.35 + 0.65 * (1 - y / TOP));
      x *= 1 + fold / width;
      z *= 1 + fold / d;
      // Lower neckline at the front, slightly at the back.
      const s = Math.sin(theta);
      const dip =
        (0.05 * Math.max(0, s) ** 2 + 0.01 * Math.max(0, -s)) * neckBlend;
      ring.push([x, y - dip, z]);
    }
    torsoRows.push(ring);
  }
  mesh.addLoft(torsoRows);

  // Ribbed collar following the neck opening.
  const neck = torsoRows[ROWS - 1];
  mesh.addLoft(ringTube(neck, 0.009), {closedRows: true});

  // The sleeve starts a little inside the body, so it joins it seamlessly.
  const INSET = 0.03;
  const SLEEVE_ROWS = long ? 30 : 18;
  const SLEEVE_RING = 40;
  [1, -1].forEach(side => {
    const r0 = SHIRT.sleeveRadius;
    // The sleeve's top edge passes through the shoulder point.
    const root = [
      side * (shoulder[0] - up[0] * r0),
      shoulder[1] - up[1] * r0,
      0,
    ];
    const length = shape.sleeveLength;
    const rows = [];
    for (let r = 0; r < SLEEVE_ROWS; r++) {
      const s = -INSET + (r / (SLEEVE_ROWS - 1)) * (length + INSET);
      const t = Math.max(0, s / length);
      // Long sleeves taper to a snug cuff; short ones flare slightly. Both
      // are thinner than the body, so their root stays hidden inside it.
      const ru = r0 - (long ? 0.038 : -0.004) * smoothstep(t);
      const rz = 0.062 - (long ? 0.02 : 0.004) * smoothstep(t);
      const c = [root[0] + side * dir[0] * s, root[1] + dir[1] * s, 0];
      const ring = [];
      for (let i = 0; i < SLEEVE_RING; i++) {
        const theta = (i / SLEEVE_RING) * TAU;
        const [a, b] = superEllipse(theta, ru, rz, 2.2);
        const fold = 0.003 * Math.sin(9 * theta + 8 * t);
        const x = c[0] + side * up[0] * (a + fold);
        // Keep the sleeve under the shoulder line, which carries on past the
        // shoulder point, so the shoulder rounds smoothly into the sleeve. The
        // line dips towards the front and back, so the sleeve thins to a seam
        // along the top and never peeks over the shoulder from below.
        const z = b + fold;
        const y = Math.min(
          c[1] + up[1] * (a + fold),
          seamY(Math.abs(x)) - 0.004 - 0.3 * Math.abs(z),
        );
        ring.push([x, y, z]);
      }
      rows.push(ring);
    }
    mesh.addLoft(rows);
  });

  const mid = mesh.center();
  return {
    mesh,
    name: 'Shirt',
    // Chest print area, in the centred coordinate space of the model.
    decal: {
      position: [0, 0.16, 0.12],
      rotation: [0, 0, 0],
      scale: [0.24, 0.24, 0.3],
    },
    mid,
  };
}

// ---------------------------------------------------------------------------
// Pants
// ---------------------------------------------------------------------------

/**
 * Full-length pants, or shorts that stop at the knee.
 *
 * Proportions follow a flat-lay of slim jeans: the waist is at y = 1 and the
 * crotch point (fork) is high. Above it the legs overlap and merge into the
 * hips; below it they part in a narrow V that widens steadily to a slim hem.
 * The tables below describe the default shape; a fitted shape moves the fork
 * and the hem (stretching the garment between them) and the legs' hem width
 * and spread (blending in from nothing at the fork).
 */
function buildPants(variant = 'long-pants', measured = null) {
  const shorts = variant === 'shorts';
  const shape = resolveShape(shorts ? 'shorts' : 'long-pants', measured);
  const base = SHAPES[shorts ? 'shorts' : 'long-pants'].defaults;
  const mesh = new Mesh();
  const RING = 64;
  const TOP = 1.0;
  const FORK = 1 - base.rise;
  const HIP_BOTTOM = 0.62;
  const LEG_TOP = 0.76;
  const LEG_BOTTOM = 1 - base.length;

  // The default shape is stretched so its fork and hem land on the fitted ones.
  const fork = TOP - shape.rise;
  const bottom = TOP - shape.length;
  const mapY = y =>
    y < FORK
      ? bottom + ((y - LEG_BOTTOM) / (FORK - LEG_BOTTOM)) * (fork - bottom)
      : fork + ((y - FORK) / (TOP - FORK)) * (TOP - fork);

  // Waist to hip: [y, half width, half depth]. The bottom of the hip tube is
  // no deeper than the two legs joined together, so it disappears inside them.
  const hips = [
    [HIP_BOTTOM, 0.21, 0.102],
    [0.68, 0.228, 0.124],
    [0.76, 0.228, 0.126],
    [0.86, 0.208, 0.114],
    [0.94, 0.194, 0.106],
    [TOP, 0.194, 0.106],
  ];
  const hipRows = [];
  const HIP_ROWS = 28;
  for (let r = 0; r < HIP_ROWS; r++) {
    const y = HIP_BOTTOM + (r / (HIP_ROWS - 1)) * (TOP - HIP_BOTTOM);
    const [w, d] = profile(hips, y);
    const band = y > 0.945 ? 0.004 : 0; // waistband
    const ring = [];
    for (let i = 0; i < RING; i++) {
      const theta = (i / RING) * TAU;
      const [x, z] = superEllipse(theta, w + band, d + band, 2.5);
      ring.push([x, mapY(y), z]);
    }
    hipRows.push(ring);
  }
  mesh.addLoft(hipRows);

  // Legs: [y, centre x, half width, half depth]. Each leg's inner edge
  // (centre - half width) runs in a straight line from the hem up to the
  // fork, where the legs meet; the outer edge tapers in towards the hem.
  const jeansLeg = [
    [-0.14, 0.121, 0.051, 0.056],
    [0.0, 0.119, 0.0614, 0.062],
    [0.2, 0.1173, 0.0773, 0.074],
    [0.4, 0.1152, 0.0924, 0.092],
    [0.5, 0.1149, 0.1009, 0.106],
    [0.6, 0.1125, 0.1075, 0.118],
  ];
  // Shorts have a roomier, straighter leg than the slim jeans: the inner edge
  // still runs straight to the fork, but the outer edge stays put.
  const shortsLeg = [
    [0.3, 0.112, 0.092, 0.1],
    [0.4, 0.111, 0.0975, 0.108],
    [0.5, 0.1107, 0.1028, 0.114],
    [0.6, 0.1144, 0.1081, 0.12],
  ];
  const leg = [
    ...(shorts ? shortsLeg : jeansLeg),
    [FORK, 0.112, 0.112, 0.123],
    // Above the fork the legs overlap and merge into the hips.
    [0.7, 0.105, 0.115, 0.122],
    [LEG_TOP, 0.1, 0.118, 0.118],
  ];
  // The fitted hem: its leg width and centre, blended in from the fork down.
  const [hemCx, hemW] = profile(leg, LEG_BOTTOM);
  const fitCx = shape.hemOuter - shape.hemHalf - hemCx;
  const fitW = shape.hemHalf - hemW;
  const LEG_ROWS = 48;
  [1, -1].forEach(side => {
    const rows = [];
    for (let r = 0; r < LEG_ROWS; r++) {
      const y = LEG_BOTTOM + (r / (LEG_ROWS - 1)) * (LEG_TOP - LEG_BOTTOM);
      const t = y < FORK ? (FORK - y) / (FORK - LEG_BOTTOM) : 0;
      const [baseCx, baseW, baseD] = profile(leg, y);
      const cx = baseCx + fitCx * t;
      const w = baseW + fitW * t;
      const d = baseD * (w / baseW);
      const ring = [];
      for (let i = 0; i < RING; i++) {
        const theta = (i / RING) * TAU;
        let [x, z] = superEllipse(theta, w, d, 2.3);
        // Gentle wrinkles that gather towards the hem.
        const fold =
          0.005 *
          Math.sin(10 * theta + 22 * y) *
          Math.max(0, 1 - (y - LEG_BOTTOM) / (LEG_TOP - LEG_BOTTOM)) ** 1.5;
        x += Math.sign(x) * fold;
        z += Math.sign(z) * fold;
        ring.push([side * cx + x, mapY(y), z]);
      }
      rows.push(ring);
    }
    mesh.addLoft(rows);
  });

  const mid = mesh.center();
  return {
    mesh,
    name: 'Pants',
    // Front of the left thigh.
    decal: {
      position: [0.105, mapY(0.64) - mid[1], 0.14],
      rotation: [0, 0, 0],
      scale: [0.17, 0.17, 0.3],
    },
    mid,
  };
}

/** Builds the garment for a variant, fitted to `shape` when given. */
function buildGarment(variant, shape) {
  return variant === 'long-pants' || variant === 'shorts'
    ? buildPants(variant, shape)
    : buildShirt(variant, shape);
}

// ---------------------------------------------------------------------------
// Front outline, for the camera's guide
// ---------------------------------------------------------------------------

/**
 * The default garment seen flat from the front, as closed polygons of [x, y]
 * points (y up) for the camera's guide outline:
 *   shirt: {outline, cuffs: [[a, b], ...]}  the long-sleeve shirt, plus where
 *          a short sleeve ends
 *   pants: {outline, cuffs}                 the long pants, plus where shorts
 *          end
 */
function frontOutline(kind) {
  if (kind === 'pants') {
    const {length, rise, hemOuter, hemHalf} = SHAPES['long-pants'].defaults;
    const shortsLength = SHAPES.shorts.defaults.length;
    const top = 1;
    const fork = top - rise;
    const hem = top - length;
    const waist = PANTS.waistHalf;
    const hip = 0.228;
    const inner = hemOuter - 2 * hemHalf;
    const right = [
      [waist, top],
      [hip, 0.76],
      [hip - 0.008, fork - 0.06],
      [hemOuter, hem],
      [inner, hem],
    ];
    const outline = [
      ...right,
      [0, fork],
      ...right.reverse().map(([x, y]) => [-x, y]),
    ];
    // Where shorts end: across each leg at that height.
    const y = top - shortsLength;
    const k = (fork - y) / (fork - hem);
    const outerAt = hip - 0.008 + (hemOuter - hip + 0.008) * k;
    const innerAt = inner * k;
    return {
      outline,
      cuffs: [
        [
          [innerAt, y],
          [outerAt, y],
        ],
        [
          [-innerAt, y],
          [-outerAt, y],
        ],
      ],
    };
  }

  const long = resolveShape('long-sleeve', null);
  const short = resolveShape('short-sleeve', null);
  const {shoulder, dir, up} = sleeveFrame(long);
  const r0 = SHIRT.sleeveRadius;
  const root = [shoulder[0] - up[0] * r0, shoulder[1] - up[1] * r0];
  const along = (s, r) => [
    root[0] + dir[0] * s + up[0] * r,
    root[1] + dir[1] * s + up[1] * r,
  ];
  // The sleeve's underside meets the body's side at the armpit.
  const under = along(0, -r0);
  const toSide = (SHIRT.halfWidth - under[0]) / dir[0];
  const armpit = [SHIRT.halfWidth, under[1] + dir[1] * toSide];
  const cuff = r0 - 0.038;
  const right = [
    [0.09, long.length],
    shoulder,
    along(long.sleeveLength, cuff),
    along(long.sleeveLength, -cuff),
    armpit,
    [SHIRT.halfWidth, 0],
  ];
  const outline = [
    [0, long.length - 0.04],
    ...right,
    ...right.reverse().map(([x, yy]) => [-x, yy]),
  ];
  const shortEnd = [
    along(short.sleeveLength, r0),
    along(short.sleeveLength, -r0),
  ];
  return {
    outline,
    cuffs: [shortEnd, shortEnd.map(([x, yy]) => [-x, yy])],
  };
}

module.exports = {
  SHIRT,
  PANTS,
  SHAPES,
  resolveShape,
  buildGarment,
  buildShirt,
  buildPants,
  frontOutline,
};
