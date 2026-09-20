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

/** Short-sleeve tee, or a long-sleeve shirt with sleeves angled down to the cuff. */
function buildShirt({long = false} = {}) {
  const mesh = new Mesh();
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

  const torsoRows = [];
  for (let r = 0; r < ROWS; r++) {
    const y = (r / (ROWS - 1)) * TOP;
    const [w, d] = profile(torso, y);
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
    torsoRows.push(ring);
  }
  mesh.addLoft(torsoRows);

  // Ribbed collar following the neck opening.
  const neck = torsoRows[ROWS - 1];
  mesh.addLoft(ringTube(neck, 0.009), {closedRows: true});

  // Short sleeves.
  const tilt = ((long ? 46 : 38) * Math.PI) / 180;
  const dir = [Math.cos(tilt), -Math.sin(tilt), 0];
  const up = [Math.sin(tilt), Math.cos(tilt), 0];
  const SLEEVE_ROWS = long ? 30 : 16;
  const SLEEVE_RING = 40;
  [1, -1].forEach(side => {
    const root = [side * 0.16, 0.588, 0];
    const length = long ? 0.6 : 0.27;
    const rows = [];
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
      const ring = [];
      for (let i = 0; i < SLEEVE_RING; i++) {
        const theta = (i / SLEEVE_RING) * TAU;
        const [a, b] = superEllipse(theta, ru, rz, 2.2);
        const fold = 0.003 * Math.sin(9 * theta + 8 * t);
        ring.push([
          c[0] + side * up[0] * (a + fold),
          c[1] + up[1] * (a + fold),
          b + fold,
        ]);
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

/** Full-length pants, or shorts that stop at the knee. */
function buildPants({shorts = false} = {}) {
  const mesh = new Mesh();
  const RING = 64;
  const TOP = 1.0;
  const HIP_BOTTOM = 0.5;
  const LEG_TOP = 0.66;
  const LEG_BOTTOM = shorts ? 0.3 : 0;

  // Waist to hip: [y, half width, half depth]. The hip tube tapers inwards at
  // the bottom so it disappears inside the legs, forming the crotch seam.
  const hips = [
    [HIP_BOTTOM, 0.17, 0.09],
    [0.6, 0.232, 0.13],
    [0.72, 0.228, 0.127],
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

  // Legs: [y, centre x, half width, half depth]. They start inside the hips.
  const leg = [
    [0.0, 0.11, 0.083, 0.085],
    [0.12, 0.111, 0.088, 0.09],
    [0.28, 0.112, 0.096, 0.1],
    [0.42, 0.114, 0.108, 0.114],
    [0.52, 0.114, 0.114, 0.126],
    [LEG_TOP, 0.114, 0.104, 0.112],
  ];
  const LEG_ROWS = 40;
  [1, -1].forEach(side => {
    const rows = [];
    for (let r = 0; r < LEG_ROWS; r++) {
      const y = LEG_BOTTOM + (r / (LEG_ROWS - 1)) * (LEG_TOP - LEG_BOTTOM);
      const [cx, w, d] = profile(leg, y);
      const ring = [];
      for (let i = 0; i < RING; i++) {
        const theta = (i / RING) * TAU;
        let [x, z] = superEllipse(theta, w, d, 2.3);
        // Gentle wrinkles that gather towards the ankle.
        const fold =
          0.005 *
          Math.sin(10 * theta + 22 * y) *
          (1 - (y - LEG_BOTTOM) / (LEG_TOP - LEG_BOTTOM)) ** 1.5;
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
    // Front of the left thigh.
    decal: {
      position: [0.115, shorts ? -0.01 : 0.14, 0.14],
      rotation: [0, 0, 0],
      scale: [0.17, 0.17, 0.3],
    },
    mid,
  };
}

// ---------------------------------------------------------------------------
// GLB writer
// ---------------------------------------------------------------------------

function toGLB({mesh, name, decal}) {
  const positions = new Float32Array(mesh.positions.flat());
  const normals = new Float32Array(mesh.normals.flat());
  const indices = new Uint32Array(mesh.indices);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  mesh.positions.forEach(p =>
    p.forEach((v, i) => {
      min[i] = Math.min(min[i], v);
      max[i] = Math.max(max[i], v);
    }),
  );

  const posBytes = Buffer.from(positions.buffer);
  const nrmBytes = Buffer.from(normals.buffer);
  const idxBytes = Buffer.from(indices.buffer);
  const bin = Buffer.concat([posBytes, nrmBytes, idxBytes]);

  const gltf = {
    asset: {version: '2.0', generator: 'wardrobe/scripts/generate-models.js'},
    scene: 0,
    scenes: [{nodes: [0]}],
    nodes: [{name, mesh: 0, extras: {decal}}],
    meshes: [
      {
        name,
        primitives: [
          {attributes: {POSITION: 0, NORMAL: 1}, indices: 2, material: 0},
        ],
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
