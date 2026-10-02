/**
 * Builds the blank 3D garments (short- and long-sleeve shirts, long pants and
 * shorts) as plain vertex arrays. The garments are lofted from smooth
 * cross-sections, so they are reproducible and dependency free.
 *
 * Every garment of a variant uses the same standard model; the user's photo
 * is warped to fit it (see webview/scene.js).
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
const smoothstep = t => {
  const c = Math.min(1, Math.max(0, t));
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
// Standard proportions
// ---------------------------------------------------------------------------

/**
 * The standard shirt, in model units: the hem at y = 0, the collar's top at
 * `length`. The body is a little wider than the pants' waist, which it covers
 * in the Outfit view.
 */
const SHIRT = {
  length: 0.725,
  halfWidth: 0.22,
  // Shoulder point: x from the centre, and how far below the collar's top.
  // The shoulder line slopes about 26 degrees from the collar down to it.
  shoulderX: 0.256,
  shoulderDrop: 0.0858,
  shoulderSlope: 0.49,
  // Sleeves hang from the shoulder point, angled below horizontal.
  sleeveAngle: 46,
  sleeveRadius: 0.086,
  sleeveLength: {short: 0.19, long: 0.6},
};

/**
 * The standard pants: the waist at y = 1, the crotch point (fork) `rise`
 * below it, the hem `length` below it.
 */
const PANTS = {
  waistHalf: 0.198,
  rise: 0.34,
  length: {long: 1.14, shorts: 0.7},
};

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
 * Where a shirt's sleeves sit: the shoulder point (the sleeve's top edge
 * passes through it), the sleeve's direction and its "up" side, for the
 * right-hand sleeve (mirror x for the left).
 */
function sleeveFrame() {
  const tilt = SHIRT.sleeveAngle * DEG;
  return {
    shoulder: [SHIRT.shoulderX, SHIRT.length - SHIRT.shoulderDrop],
    dir: [Math.cos(tilt), -Math.sin(tilt)],
    up: [Math.sin(tilt), Math.cos(tilt)],
  };
}

/**
 * Short-sleeve tee, or a long-sleeve shirt with sleeves angled down to the
 * cuff. A flat-lay tee: a boxy body with straight sides, shoulders on one
 * straight line sloping from the collar to the shoulder point, sleeves
 * hanging from it with a natural gap under the arm (a short sleeve is the
 * first stretch of a long one).
 */
function buildShirt({long = false} = {}) {
  const mesh = new Mesh();
  const RING = 72;
  const ROWS = 80;
  const TOP = SHIRT.length;

  const {shoulder, dir, up} = sleeveFrame();
  const SLOPE = SHIRT.shoulderSlope;
  const seamY = x => shoulder[1] + (shoulder[0] - x) * SLOPE;
  const seamX = y => shoulder[0] - (y - shoulder[1]) / SLOPE;

  // [y, half width, half depth]. A boxy tee: straight sides from the hem up
  // to the armpit; above that the width follows the shoulder line. The body
  // is a little wider than the pants' waist, which it covers in the Outfit
  // view (the hem hangs 0.13 below the waistband there).
  const torso = [
    [0.0, 0.22, 0.096],
    [0.42, 0.22, 0.098],
    [0.64, 0.225, 0.098],
    [0.667, 0.225, 0.092],
    [0.685, 0.225, 0.078],
    [0.712, 0.225, 0.064],
    [TOP, 0.09, 0.06],
  ];

  const torsoRows = [];
  for (let r = 0; r < ROWS; r++) {
    const y = (r / (ROWS - 1)) * TOP;
    const [pw, d] = profile(torso, y);
    const w = Math.min(pw, Math.max(0.09, seamX(y)));
    const neckBlend = smoothstep((y - 0.6) / (TOP - 0.6));
    const ring = [];
    for (let i = 0; i < RING; i++) {
      const theta = (i / RING) * TAU;
      let [x, z] = superEllipse(theta, w, d);
      // Soft fabric folds, strongest near the hem.
      const fold =
        0.006 *
        (Math.sin(11 * theta + 6 * y) +
          0.6 * Math.sin(17 * theta - 9 * y + 1.3)) *
        (0.35 + 0.65 * (1 - y / TOP));
      x *= 1 + fold / w;
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
    const length = long ? SHIRT.sleeveLength.long : SHIRT.sleeveLength.short;
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
 * crotch point (fork) is high, at y = FORK. Above it the legs overlap and
 * merge into the hips; below it they part in a narrow V that widens steadily
 * to a slim hem. Long pants hang to y = -0.14, so the inseam (FORK to hem,
 * 0.8) is about 70% of the whole length, as on real jeans.
 */
function buildPants({shorts = false} = {}) {
  const mesh = new Mesh();
  const RING = 64;
  const TOP = 1.0;
  const FORK = TOP - PANTS.rise;
  const HIP_BOTTOM = 0.62;
  const LEG_TOP = 0.76;
  const LEG_BOTTOM = TOP - (shorts ? PANTS.length.shorts : PANTS.length.long);

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
      ring.push([x, y, z]);
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
  const LEG_ROWS = 48;
  [1, -1].forEach(side => {
    const rows = [];
    for (let r = 0; r < LEG_ROWS; r++) {
      const y = LEG_BOTTOM + (r / (LEG_ROWS - 1)) * (LEG_TOP - LEG_BOTTOM);
      const [cx, w, d] = profile(leg, y);
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
        ring.push([side * cx + x, y, z]);
      }
      rows.push(ring);
    }
    mesh.addLoft(rows);
  });

  const mid = mesh.center();
  return {
    mesh,
    name: 'Pants',
    // Front of the left thigh (about y = 0.64 above the hem line).
    decal: {
      position: [0.105, 0.64 - mid[1], 0.14],
      rotation: [0, 0, 0],
      scale: [0.17, 0.17, 0.3],
    },
    mid,
  };
}

/** Builds the standard garment for a variant. */
function buildGarment(variant) {
  switch (variant) {
    case 'long-sleeve':
      return buildShirt({long: true});
    case 'long-pants':
      return buildPants();
    case 'shorts':
      return buildPants({shorts: true});
    default:
      return buildShirt();
  }
}

// ---------------------------------------------------------------------------
// Front outline, for the camera's guide
// ---------------------------------------------------------------------------

/**
 * The standard garment seen flat from the front, as a closed polygon of
 * [x, y] points (y up) for the camera's guide outline, plus lines across it
 * where a shorter variant ends:
 *   shirt: the long-sleeve shirt; `cuffs` where a short sleeve ends
 *   pants: the long pants; `cuffs` where shorts end
 */
function frontOutline(kind) {
  if (kind === 'pants') {
    const top = 1;
    const fork = top - PANTS.rise;
    const hem = top - PANTS.length.long;
    // The long pants' leg at the hem (see jeansLeg in buildPants).
    const hemOuter = 0.121 + 0.051;
    const inner = 0.121 - 0.051;
    const hip = 0.228;
    const right = [
      [PANTS.waistHalf, top],
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
    const y = top - PANTS.length.shorts;
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

  const {shoulder, dir, up} = sleeveFrame();
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
    [0.09, SHIRT.length],
    shoulder,
    along(SHIRT.sleeveLength.long, cuff),
    along(SHIRT.sleeveLength.long, -cuff),
    armpit,
    [SHIRT.halfWidth, 0],
  ];
  const outline = [
    [0, SHIRT.length - 0.04],
    ...right,
    ...right.reverse().map(([x, y]) => [-x, y]),
  ];
  const shortEnd = [
    along(SHIRT.sleeveLength.short, r0),
    along(SHIRT.sleeveLength.short, -r0),
  ];
  return {
    outline,
    cuffs: [shortEnd, shortEnd.map(([x, y]) => [-x, y])],
  };
}

module.exports = {SHIRT, PANTS, buildGarment, frontOutline};
