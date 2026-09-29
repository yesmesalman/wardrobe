/**
 * Generates the blank 3D garment models shipped with the app:
 *   src/assets/models/blank_shirt.glb        short-sleeve shirt
 *   src/assets/models/blank_shirt_long.glb   long-sleeve shirt
 *   src/assets/models/blank_pants.glb        long pants
 *   src/assets/models/blank_shorts.glb       shorts
 *
 * The garments are lofted from smooth cross-sections, so the models are
 * reproducible and dependency free. Run with `npm run generate:models`.
 *
 * Every model is a single mesh (node "Shirt" / "Pants") with one material
 * ("Fabric") and a `decal` entry in the node extras that tells the app where
 * a user's photo is projected onto the garment.
 *
 * The shirts are shaped like a flat-lay photo (sleeves spread), which is what
 * the user's photo is fitted to, and carry one morph target, "rest", that
 * lets the sleeves hang at the sides like arms at rest. The app shows the
 * rest pose and keeps projecting the photo through the flat-lay shape.
 */
const {Buffer} = require('buffer');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'src', 'assets', 'models');

// ---------------------------------------------------------------------------
// Small math helpers
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
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

/** Resting arms hang this far out from vertical: almost straight, close to the body. */
const REST_ANGLE = (3 * Math.PI) / 180;
/** Sleeves at rest are this much slimmer than in the flat-lay, like a worn tee. */
const REST_SLIM = 0.7;
/**
 * Top of the resting sleeve: the rounded shoulder point. It overlaps the end
 * of the shoulder slope, so the outline runs from the collar over the
 * shoulder and down the arm.
 */
const SHOULDER = [0.25, 0.655];

/**
 * A right sleeve (x > 0) hanging at rest, as `count` rows from the shoulder
 * point down to the hem, `length` long. Each row has its centre, the
 * direction of the arm there and how open it is (0 at the top, 1 once the
 * rounded cap has widened to the full sleeve). Rows crowd towards the top so
 * the cap is smooth.
 */
function restingSleeve(count, length, cap) {
  const down = [Math.sin(REST_ANGLE), -Math.cos(REST_ANGLE)];
  const rows = [];
  for (let r = 0; r < count; r++) {
    const t = r / (count - 1);
    const s = length * t ** 1.6;
    // A half-dome: open by sqrt(1 - (1 - s / cap)^2) until it is `cap` deep.
    const k = Math.min(1, s / cap);
    rows.push({
      centre: [SHOULDER[0] + down[0] * s, SHOULDER[1] + down[1] * s],
      dir: down,
      open: Math.sqrt(1 - (1 - k) ** 2),
      t: s / length,
    });
  }
  return rows;
}

/** Short-sleeve tee, or a long-sleeve shirt with sleeves angled down to the cuff. */
function buildShirt({long = false} = {}) {
  const mesh = new Mesh();
  // The same garment with the sleeves hanging at rest (vertex for vertex).
  const rest = new Mesh();
  const RING = 72;
  const ROWS = 48;
  const TOP = 0.725;

  // [y, half width, half depth]
  const torso = [
    [0.0, 0.214, 0.099],
    [0.06, 0.212, 0.097],
    [0.3, 0.2, 0.092],
    [0.48, 0.223, 0.104],
    [0.6, 0.244, 0.1],
    [0.66, 0.19, 0.08],
    [0.71, 0.098, 0.063],
    [TOP, 0.09, 0.06],
  ];
  // At rest the shoulder slopes from the collar out onto the rounded top of
  // the sleeve, so the two read as one line.
  const restTorso = [
    [0.0, 0.214, 0.099],
    [0.06, 0.212, 0.097],
    [0.3, 0.2, 0.092],
    [0.48, 0.223, 0.104],
    [0.6, 0.235, 0.1],
    [0.645, 0.248, 0.09],
    [0.672, 0.225, 0.078],
    [0.692, 0.16, 0.068],
    [0.712, 0.102, 0.063],
    [TOP, 0.09, 0.06],
  ];

  const torsoRing = (table, y) => {
    const [w, d] = profile(table, y);
    const neckBlend = smoothstep((y - 0.6) / (TOP - 0.6));
    const ring = [];
    for (let i = 0; i < RING; i++) {
      const theta = (i / RING) * TAU;
      let [x, z] = superEllipse(theta, w, d);
      // Soft fabric folds, strongest near the hem.
      const fold =
        0.006 *
        (Math.sin(11 * theta + 6 * y) + 0.6 * Math.sin(17 * theta - 9 * y + 1.3)) *
        (0.35 + 0.65 * (1 - y / TOP));
      x *= 1 + fold / w;
      z *= 1 + fold / d;
      // Lower neckline at the front, slightly at the back.
      const s = Math.sin(theta);
      const dip =
        (0.05 * Math.max(0, s) ** 2 + 0.01 * Math.max(0, -s)) * neckBlend;
      ring.push([x, y - dip, z]);
    }
    return ring;
  };
  const torsoRows = [];
  const restTorsoRows = [];
  for (let r = 0; r < ROWS; r++) {
    const y = (r / (ROWS - 1)) * TOP;
    torsoRows.push(torsoRing(torso, y));
    restTorsoRows.push(torsoRing(restTorso, y));
  }
  mesh.addLoft(torsoRows);
  rest.addLoft(restTorsoRows);

  // Ribbed collar following the neck opening.
  const neck = torsoRows[ROWS - 1];
  mesh.addLoft(ringTube(neck, 0.009), {closedRows: true});
  rest.addLoft(ringTube(neck, 0.009), {closedRows: true});

  // Sleeves, spread as in a flat-lay photo.
  const tilt = ((long ? 46 : 38) * Math.PI) / 180;
  const dir = [Math.cos(tilt), -Math.sin(tilt), 0];
  const up = [Math.sin(tilt), Math.cos(tilt), 0];
  const SLEEVE_ROWS = long ? 30 : 16;
  const SLEEVE_RING = 40;
  // At rest a long sleeve reaches down to the hem; a short one to mid upper
  // arm. The rounded cap is as deep as the sleeve is wide.
  const resting = restingSleeve(
    SLEEVE_ROWS,
    long ? 0.615 : 0.255,
    0.088 * REST_SLIM,
  );
  [1, -1].forEach(side => {
    const root = [side * 0.16, 0.588, 0];
    const length = long ? 0.6 : 0.27;
    const rows = [];
    const restRows = [];
    for (let r = 0; r < SLEEVE_ROWS; r++) {
      const t = r / (SLEEVE_ROWS - 1);
      // Long sleeves taper to a snug cuff; short ones stay loose.
      const ru = 0.088 - (long ? 0.04 : 0.02) * smoothstep(t);
      const rz = 0.086 - (long ? 0.038 : 0.02) * smoothstep(t);
      const c = [
        root[0] + side * dir[0] * length * t,
        root[1] + dir[1] * length * t,
        0,
      ];
      // At rest: slimmer, closed into a rounded cap at the shoulder, tapering
      // the same way down the arm.
      const {centre, dir: hang, open, t: rt} = resting[r];
      const restUp = [-hang[1], hang[0]];
      const restScale = REST_SLIM * open;
      const restU =
        (0.088 - (long ? 0.04 : 0.02) * smoothstep(rt)) * restScale;
      const restZ =
        (0.086 - (long ? 0.038 : 0.02) * smoothstep(rt)) * restScale;
      const ring = [];
      const restRing = [];
      for (let i = 0; i < SLEEVE_RING; i++) {
        const theta = (i / SLEEVE_RING) * TAU;
        const [a, b] = superEllipse(theta, ru, rz, 2.2);
        const fold = 0.003 * Math.sin(9 * theta + 8 * t);
        ring.push([
          c[0] + side * up[0] * (a + fold),
          c[1] + up[1] * (a + fold),
          b + fold,
        ]);
        const [ra, rb] = superEllipse(theta, restU, restZ, 2.2);
        const restFold = fold * restScale;
        restRing.push([
          side * (centre[0] + restUp[0] * (ra + restFold)),
          centre[1] + restUp[1] * (ra + restFold),
          rb + restFold,
        ]);
      }
      rows.push(ring);
      restRows.push(restRing);
    }
    mesh.addLoft(rows);
    rest.addLoft(restRows);
  });

  const mid = mesh.center();
  rest.positions = rest.positions.map(p => sub(p, mid));
  return {
    mesh,
    rest,
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
  const FORK = 0.66;
  const HIP_BOTTOM = 0.62;
  const LEG_TOP = 0.76;
  const LEG_BOTTOM = shorts ? 0.3 : -0.14;

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

// ---------------------------------------------------------------------------
// GLB writer
// ---------------------------------------------------------------------------

const bounds = points => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  points.forEach(p =>
    p.forEach((v, i) => {
      min[i] = Math.min(min[i], v);
      max[i] = Math.max(max[i], v);
    }),
  );
  return {min, max};
};

function toGLB({mesh, rest, name, decal}) {
  const positions = new Float32Array(mesh.positions.flat());
  const normals = new Float32Array(mesh.normals.flat());
  const indices = new Uint32Array(mesh.indices);
  const {min, max} = bounds(mesh.positions);

  const posBytes = Buffer.from(positions.buffer);
  const nrmBytes = Buffer.from(normals.buffer);
  const idxBytes = Buffer.from(indices.buffer);

  // The "rest" morph target: how far each vertex and normal moves.
  let restDeltas = null;
  if (rest) {
    const dp = rest.positions.map((p, i) => sub(p, mesh.positions[i]));
    const dn = rest.normals.map((n, i) => sub(n, mesh.normals[i]));
    restDeltas = {
      bounds: bounds(dp),
      pos: Buffer.from(new Float32Array(dp.flat()).buffer),
      nrm: Buffer.from(new Float32Array(dn.flat()).buffer),
    };
  }
  const bin = Buffer.concat(
    [posBytes, nrmBytes, idxBytes].concat(
      restDeltas ? [restDeltas.pos, restDeltas.nrm] : [],
    ),
  );
  const restOffset = posBytes.length + nrmBytes.length + idxBytes.length;

  const gltf = {
    asset: {version: '2.0', generator: 'wardrobe/scripts/generate-models.js'},
    scene: 0,
    scenes: [{nodes: [0]}],
    nodes: [{name, mesh: 0, extras: {decal}}],
    meshes: [
      {
        name,
        primitives: [
          {
            attributes: {POSITION: 0, NORMAL: 1},
            indices: 2,
            material: 0,
            ...(restDeltas ? {targets: [{POSITION: 3, NORMAL: 4}]} : {}),
          },
        ],
        ...(restDeltas ? {weights: [1], extras: {targetNames: ['rest']}} : {}),
      },
    ],
    materials: [
      {
        name: 'Fabric',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 0.85,
        },
        doubleSided: true,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: mesh.positions.length,
        type: 'VEC3',
        min,
        max,
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: mesh.normals.length,
        type: 'VEC3',
      },
      {bufferView: 2, componentType: 5125, count: indices.length, type: 'SCALAR'},
      ...(restDeltas
        ? [
            {
              bufferView: 3,
              componentType: 5126,
              count: mesh.positions.length,
              type: 'VEC3',
              ...restDeltas.bounds,
            },
            {
              bufferView: 4,
              componentType: 5126,
              count: mesh.normals.length,
              type: 'VEC3',
            },
          ]
        : []),
    ],
    bufferViews: [
      {buffer: 0, byteOffset: 0, byteLength: posBytes.length, target: 34962},
      {
        buffer: 0,
        byteOffset: posBytes.length,
        byteLength: nrmBytes.length,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: posBytes.length + nrmBytes.length,
        byteLength: idxBytes.length,
        target: 34963,
      },
      ...(restDeltas
        ? [
            {
              buffer: 0,
              byteOffset: restOffset,
              byteLength: restDeltas.pos.length,
              target: 34962,
            },
            {
              buffer: 0,
              byteOffset: restOffset + restDeltas.pos.length,
              byteLength: restDeltas.nrm.length,
              target: 34962,
            },
          ]
        : []),
    ],
    buffers: [{byteLength: bin.length}],
  };

  const pad = (buf, byte) => {
    const rem = buf.length % 4;
    return rem ? Buffer.concat([buf, Buffer.alloc(4 - rem, byte)]) : buf;
  };
  const jsonChunk = pad(Buffer.from(JSON.stringify(gltf)), 0x20);
  const binChunk = pad(bin, 0);
  const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // "glTF"
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const chunkHeader = (length, type) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(length, 0);
    h.writeUInt32LE(type, 4);
    return h;
  };
  return Buffer.concat([
    header,
    chunkHeader(jsonChunk.length, 0x4e4f534a),
    jsonChunk,
    chunkHeader(binChunk.length, 0x004e4942),
    binChunk,
  ]);
}

fs.mkdirSync(OUT_DIR, {recursive: true});
[
  ['blank_shirt.glb', buildShirt()],
  ['blank_shirt_long.glb', buildShirt({long: true})],
  ['blank_pants.glb', buildPants()],
  ['blank_shorts.glb', buildPants({shorts: true})],
].forEach(([file, model]) => {
  const glb = toGLB(model);
  fs.writeFileSync(path.join(OUT_DIR, file), glb);
  console.log(
    `${file}: ${model.mesh.positions.length} vertices, ${(glb.length / 1024).toFixed(0)} KB`,
  );
});
