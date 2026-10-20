// What doesn't break: the hilltop and the land round it (one mesh from the height function, dry
// grass and thyme mixed with bare pale rock, cliffs of marble rock down to the sea, ochre hills
// with dark scrub inland), the sea (shaded on the plane near by and, past it, on a shell round the
// camera, so it runs on to the horizon), islands in the haze, and scattered olive scrub on the
// slopes. In the physics world: the plateau, and the cliffs and slopes near it as fixed hulls. The
// breakable ground on the hilltop is cut out of the land (ground.ts lays it).

import { abs, atan, cameraPosition, clamp, color, Discard, dot, equirectUV, exp, float, Fn, If, max, mix, mx_noise_float, mx_noise_vec3, normalize, normalLocal, normalWorld, positionLocal, positionWorld, pow, reflect, smoothstep, texture, time, uniform, vec2, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { World } from 'three-avbd';
import { clip, type Convex, hullConvex, type V3 } from '../../../lib/index.ts';
import type { Sky } from '../../sky.ts';
import { textured } from '../../textures.ts';
import { pits, plateau } from './ground.ts';
import { BASE, landLook } from './land.ts';
import { AREAS, noise2, northEdge, PLACES, SEA, terrain, westEdge, within } from './layout.ts';

/** How far the land and the sea plane reach from the middle (m; the camera sees 2 km): the shell round the camera beyond. */
const REACH = 1700;
const SHELL = 560;
/** The haze over the sea: from where (m), and how deep (m) it takes to thicken by e. */
const HAZE = { from: 1000, depth: 1800 };

type Vec3 = THREE.Node<'vec3'>;
type Float = THREE.Node<'float'>;

export function buildScenery(scene: THREE.Scene, world: World, sky: Sky): void {
  physics(world);
  scene.add(land());
  const hdr = scene.background as THREE.Texture;
  const sea = seaShading(hdr, scene, sky.sunDirection);
  scene.add(seaPlane(sea), seaShell(sea, sky.sunDirection));
  scene.add(scrub(), rocks(), tufts(), boats(), pits());
}

/** Coordinates along an axis: 1 m apart near the middle, wider and wider out to REACH, and at `edges`. */
function axis(edges: number[]): number[] {
  const out: number[] = [0];
  let p = 0;
  while (p < REACH) {
    p += p < 70 ? 1 : 1 + (p - 70) * 0.055;
    out.push(Math.min(p, REACH));
  }
  return [...new Set([...out.slice(1).map((v) => -v), ...out, ...edges])].sort((a, b) => a - b);
}

/** The land, with a hole where the breakable ground is laid (the mesh's lines run along its edges). */
function land(): THREE.Mesh {
  const xs = axis(AREAS.flatMap(([x0, , x1]) => [x0, x1]));
  const zs = axis(AREAS.flatMap(([, z0, , z1]) => [z0, z1]));
  const nx = xs.length;
  const nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = 3 * (j * nx + i);
      pos[k] = xs[i];
      pos[k + 1] = terrain(xs[i], zs[j]);
      pos[k + 2] = zs[j];
    }
  const index: number[] = [];
  for (let j = 0; j + 1 < nz; j++)
    for (let i = 0; i + 1 < nx; i++) {
      const a = j * nx + i;
      // Skip quads that are wholly far under the sea, and the breakable ground's
      if ([a, a + 1, a + nx, a + nx + 1].every((v) => pos[3 * v + 1] < SEA - 12)) continue;
      if (within(AREAS, (xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2)) continue;
      index.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, landMaterial());
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'temple:land';
  return mesh;
}

function landMaterial(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.95 });
  const look = landLook(positionWorld, normalWorld);
  m.colorNode = look.color;
  m.roughnessNode = look.roughness;
  return m;
}

/** The sea's colour at a point of its plane, seen along `dir` from `dist` away; the haze's colour along `dir`. */
interface SeaShading {
  shade(p: Vec3, dir: Vec3, dist: Float): Vec3;
  horizon(dir: Vec3): Vec3;
}

/**
 * The sky just over the horizon all the way round (256 steps of azimuth, as atan(z, x) runs),
 * averaged over the first few degrees up and ±11° round: the haze's colour. Made once from the
 * map's pixels. Sampled straight from the map, the rows near the horizon vary only round it, so
 * wherever the haze is thick their detail would be drawn out into radial streaks across the sea.
 */
function horizonStrip(hdr: THREE.Texture, turn: THREE.Matrix4, strength: number): THREE.DataTexture {
  const { width, height, data } = hdr.image as { width: number; height: number; data: Uint16Array | Float32Array };
  const read = data instanceof Uint16Array ? (i: number) => THREE.DataUtils.fromHalfFloat(data[i]) : (i: number) => data[i];
  const n = 256;
  const out = new Uint16Array(n * 4);
  const d = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    const phi = ((k + 0.5) / n) * Math.PI * 2 - Math.PI;
    const sum = [0, 0, 0];
    let count = 0;
    for (let j = -7; j <= 7; j++)
      for (const up of [0.015, 0.035, 0.06, 0.09]) {
        const a = phi + j * 0.028;
        d.set(Math.cos(a), up, Math.sin(a)).normalize().transformDirection(turn);
        // three's equirectangular mapping; the file's rows run top down
        const u = Math.atan2(d.z, d.x) / (Math.PI * 2) + 0.5;
        const v = Math.asin(Math.max(-1, Math.min(1, d.y))) / Math.PI + 0.5;
        const px = ((Math.floor(u * width) % width) + width) % width;
        const py = Math.min(height - 1, Math.max(0, Math.floor((1 - v) * height)));
        const i = 4 * (py * width + px);
        for (let c = 0; c < 3; c++) sum[c] += read(i + c);
        count++;
      }
    for (let c = 0; c < 3; c++) out[4 * k + c] = THREE.DataUtils.toHalfFloat((sum[c] / count) * strength);
    out[4 * k + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const t = new THREE.DataTexture(out, n, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  t.wrapS = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function seaShading(hdr: THREE.Texture, scene: THREE.Scene, sunDir: THREE.Vector3): SeaShading {
  // The sky as the background draws it: the same map, turned the same way, at its strength
  const turn = new THREE.Matrix4().makeRotationFromEuler(scene.backgroundRotation).transpose();
  const rot = uniform(turn);
  const bg = scene.backgroundIntensity;
  // At level 0: the map wraps round where the angle does, and a derived level there draws a dotted seam
  const skyAt = (d: Vec3) => texture(hdr, equirectUV(rot.mul(vec4(d, 0)).xyz)).level(float(0)).rgb.mul(bg);
  const sun = uniform(sunDir.clone().normalize());
  // The haze: the sky low over the horizon behind it, blurred (see horizonStrip)
  const strip = horizonStrip(hdr, turn, bg);
  const hazeAt = (dir: Vec3): Vec3 => texture(strip, vec2(atan(dir.z, dir.x).div(Math.PI * 2).add(0.5), 0.5)).level(float(0)).rgb;
  const deep = color(0x123f66);
  const shallow = color(0x1f6f80);
  return {
    horizon: hazeAt,
    shade(p, dir, dist) {
      // Two layers of swell drifting, flattening with distance (it would only shimmer there)
      const flatten = float(1).div(dist.mul(0.012).add(1));
      const a = mx_noise_vec3(vec3(p.x.mul(0.06).add(time.mul(0.05)), p.z.mul(0.08), time.mul(0.04)));
      const b = mx_noise_vec3(vec3(p.x.mul(0.23), p.z.mul(0.19).sub(time.mul(0.07)), time.mul(0.09)));
      const n = normalize(vec3(a.x.mul(0.16).add(b.x.mul(0.09)).mul(flatten), 1, a.z.mul(0.16).add(b.z.mul(0.09)).mul(flatten)));
      const cosI = clamp(dot(n, dir.negate()), 0, 1);
      // Fresnel, held down once the view is more than a few degrees down onto the water: the
      // pale sky low over the horizon mirrored there turned the open sea grey
      const steep = smoothstep(0.06, 0.2, dir.y.negate());
      const fresnel = float(0.02).add(float(0.98).mul(pow(float(1).sub(cosI), 5))).mul(mix(float(1), float(0.45), steep));
      const r = reflect(dir, n);
      const up = normalize(vec3(r.x, max(r.y, 0.02), r.z));
      // Turquoise at the cliff foot, deep blue a little way out
      const coast = max(float(-38).sub(p.x), float(-34).sub(p.z)).max(0);
      const water = mix(shallow, deep, smoothstep(6, 45, coast)).mul(1.35);
      const glint = pow(max(dot(up, sun), 0), 900).mul(60).add(pow(max(dot(up, sun), 0), 120).mul(1.2));
      // The sky it reflects: right at the horizon, the haze's smooth colour (the map's rows near the
      // horizon vary only round it, and a mirror-flat far sea would draw them out into radial streaks)
      const horizon = hazeAt(dir);
      const reflected = mix(horizon, skyAt(up), smoothstep(0.02, 0.09, r.y));
      const col = mix(water, reflected, fresnel).add(vec3(1.0, 0.95, 0.85).mul(glint).mul(flatten.mul(0.7).add(0.3)));
      // Haze from about a kilometre out, no more than 0.6 until the last half degree to the horizon
      const haze = float(1).sub(exp(dist.sub(HAZE.from).max(0).div(HAZE.depth).negate())).min(0.6).max(smoothstep(-0.009, -0.0005, dir.y));
      return mix(col, horizon, haze);
    },
  };
}

/** The sea near by, on its plane: so the cliffs and islands go into it. */
function seaPlane(sea: SeaShading): THREE.Mesh {
  const m = new THREE.MeshBasicNodeMaterial({ fog: false });
  const dir = normalize(positionWorld.sub(cameraPosition));
  m.colorNode = sea.shade(positionWorld, dir, positionWorld.sub(cameraPosition).length());
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(REACH + 40, 96), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = SEA;
  mesh.name = 'temple:sea';
  return mesh;
}

/**
 * Islands far out to the west, north-west and north (1.1..1.8 km, drawn in the shell round the camera):
 * azimuth of the middle (from +x toward +z), half their width (rad), distance, height (m), seed.
 * Long and low, a couple of small ones.
 */
const ISLANDS: Array<[number, number, number, number, number]> = [
  [Math.PI * 1.03, 0.11, 1500, 48, 1],
  [Math.PI * 1.12, 0.035, 1150, 20, 2],
  [Math.PI * 1.27, 0.16, 1800, 66, 3],
  [Math.PI * 1.41, 0.05, 1300, 26, 4],
  [Math.PI * 1.55, 0.09, 1650, 40, 5],
];

/**
 * Beyond the plane: a shell round the camera where every ray below the horizon is shaded as the
 * sea it would meet, and the islands are drawn as hazed silhouettes standing on it (not limited by
 * the camera's far plane, and without parallax at that distance).
 */
function seaShell(sea: SeaShading, sunDir: THREE.Vector3): THREE.Mesh {
  const m = new THREE.MeshBasicNodeMaterial({ fog: false, side: THREE.BackSide, depthWrite: false });
  m.positionNode = positionLocal.add(cameraPosition);
  const sun = vec2(sunDir.x, sunDir.z).normalize();
  m.colorNode = Fn(() => {
    const dir = normalize(positionWorld.sub(cameraPosition));
    const phi = atan(dir.z, dir.x);
    const out = vec4(0, 0, 0, 0).toVar();
    // The islands: where the ray passes under one's crest and over the water at its foot
    for (const [a, half, D, H, seed] of ISLANDS) {
      const da = phi.sub(a);
      const u = da.sub(da.div(Math.PI * 2).round().mul(Math.PI * 2)).div(half);
      const crest = mx_noise_float(vec3(u.mul(1.7), seed * 3.1, 0.5)).mul(0.35).add(mx_noise_float(vec3(u.mul(6), seed * 1.3, 2.5)).mul(0.12)).add(0.75);
      const prof = max(float(1).sub(u.mul(u)), 0).pow(0.6).mul(crest);
      const base = float(SEA).sub(cameraPosition.y).div(D);
      const top = float(SEA).add(prof.mul(H)).sub(cameraPosition.y).div(D);
      If(out.w.equal(0).and(abs(u).lessThan(1)).and(dir.y.greaterThan(base)).and(dir.y.lessThan(top)), () => {
        // Up the island from its waterline (0) to its crest (1); its slopes catch the sun or don't
        const t = dir.y.sub(base).div(top.sub(base).max(1e-5)).clamp(0, 1);
        const face = u.sign().mul(dot(sun, vec2(Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)))).mul(0.5).add(0.5);
        const scrub = smoothstep(0.1, 0.5, mx_noise_float(vec3(u.mul(9), t.mul(3), seed)));
        const land = mix(color(0x9a927c), color(0x56604a), scrub.mul(0.7)).mul(face.mul(0.45).add(0.65));
        // Thicker haze low down, toward the horizon's colour
        const haze = mix(float(0.8), float(0.5), t.pow(0.7));
        out.assign(vec4(mix(land, sea.horizon(dir), haze), 1));
      });
    }
    If(out.w.equal(0), () => {
      If(dir.y.greaterThan(-0.0005), () => {
        Discard();
      });
      const t = float(SEA).sub(cameraPosition.y).div(dir.y.min(-1e-4));
      out.assign(vec4(sea.shade(cameraPosition.add(dir.mul(t)), dir, t), 1));
    });
    return out.xyz;
  })();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SHELL, 64, 32), m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.name = 'temple:sea-shell';
  return mesh;
}

/** Olive scrub dotting the slopes inland: clumps of three to five rounded bushes, one draw. */
function scrub(): THREE.InstancedMesh {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const mat = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 1 });
  // Darker underneath, and in the hollows of its surface (a little noise on the sphere)
  const n = normalLocal;
  const mottle = mx_noise_float(positionLocal.mul(3.1)).mul(0.18).add(0.92);
  mat.colorNode = vec3(mix(float(0.45), float(1.05), smoothstep(-0.6, 0.7, n.y)).mul(mottle));
  const count = 1400;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const tint = new THREE.Color();
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 10; tries++) {
    const a = -0.6 + rand() * (Math.PI * 0.5 + 1.4);
    const d = 25 + rand() * 320;
    const cx = Math.cos(a) * d + 10;
    const cz = Math.sin(a) * d + 10;
    // In clumps: where the scrub grows, not evenly
    if (noise2(cx * 0.03, cz * 0.03) < 0.45) continue;
    const g = 0.24 + rand() * 0.06;
    const bushes = 3 + Math.floor(rand() * 3);
    for (let b = 0; b < bushes && placed < count; b++) {
      const x = cx + (rand() - 0.5) * 2.6;
      const z = cz + (rand() - 0.5) * 2.6;
      // Outside the temenos only
      if (x < 36 && z < 26.5) continue;
      if (x < westEdge(z) + 4 || z < northEdge(x) + 4) continue;
      const w = 0.5 + rand() * 1.0;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6);
      m.compose(new THREE.Vector3(x, terrain(x, z) + w * 0.25, z), q, new THREE.Vector3(w, w * (0.6 + rand() * 0.3), w * (0.75 + rand() * 0.4)));
      mesh.setMatrixAt(placed, m);
      mesh.setColorAt(placed, tint.setRGB(g * (0.9 + rand() * 0.2), (g + 0.05) * (0.9 + rand() * 0.2), g * 0.62, THREE.SRGBColorSpace));
      placed++;
    }
  }
  mesh.count = placed;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'temple:scrub';
  return mesh;
}

/**
 * Loose pale rocks along the cliff tops and outside the temenos: low (the player and the rubble
 * pass through scenery), lit and shadowed like the ground, one draw.
 */
function rocks(): THREE.InstancedMesh {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = textured('marble_rock_02', { base: BASE, color: 0xe8e2d6 });
  const count = 260;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let s = 19;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 20; tries++) {
    const x = -48 + rand() * 110;
    const z = -46 + rand() * 90;
    const lip = Math.min(x - westEdge(z), z - northEdge(x));
    // Near the brink (but not over it), or outside the temenos to the south and east
    const brink = lip > 1.5 && lip < 9 && (x < -26 || z < -27);
    const outside = (z > 25.5 || x > 35.5) && lip > 1.5;
    if (!brink && !outside) continue;
    if (Math.abs(x - 34) < 4 && Math.abs(z - 4) < 5) continue;
    const w = 0.15 + rand() ** 2 * 0.55;
    q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 6, rand() * 3));
    m.compose(new THREE.Vector3(x, terrain(x, z) + w * 0.25, z), q, new THREE.Vector3(w, w * (0.45 + rand() * 0.3), w * (0.7 + rand() * 0.4)));
    mesh.setMatrixAt(placed++, m);
  }
  mesh.count = placed;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'temple:rocks';
  return mesh;
}

/**
 * Low tufts of thyme and dry grass where the scythe doesn't reach: along the temenos wall, at the
 * foot of the platforms and bases, round the tholos. Not physical (keep them low), one draw.
 */
function tufts(): THREE.InstancedMesh {
  // A tuft: a fan of thin blades leaning out from a tight foot (unit height), seen from both sides
  const blades = 9;
  const pos: number[] = [];
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + (i % 3) * 0.4;
    const lean = 0.25 + (i % 4) * 0.12;
    const tall = 0.65 + ((i * 7) % 5) * 0.09;
    const [c, sn] = [Math.cos(a), Math.sin(a)];
    const w = 0.07;
    pos.push(c * 0.04 - sn * w, 0, sn * 0.04 + c * w, c * 0.04 + sn * w, 0, sn * 0.04 - c * w, c * lean, tall, sn * lean);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide });
  // Darker at the foot, where the blades crowd
  mat.colorNode = vec3(mix(float(0.7), float(1.2), positionLocal.y.clamp(0, 1)));
  // Where they grow: edges from (x, z) to (x, z), the open side's direction
  const edges: Array<[number, number, number, number, number, number]> = [];
  const box = (x0: number, x1: number, z0: number, z1: number) => {
    edges.push([x0, z0, x1, z0, 0, -1], [x0, z1, x1, z1, 0, 1], [x0, z0, x0, z1, -1, 0], [x1, z0, x1, z1, 1, 0]);
  };
  const { temple: t, treasury: tr, statue: st, altar: al, tholos: th } = PLACES;
  for (const side of [-1, 1]) {
    edges.push([33.7 + (side > 0 ? 0.6 : 0), -19, 33.7 + (side > 0 ? 0.6 : 0), 0.8, side, 0], [33.7 + (side > 0 ? 0.6 : 0), 7.2, 33.7 + (side > 0 ? 0.6 : 0), 23.7, side, 0]);
    edges.push([-31, 23.7 + (side > 0 ? 0.6 : 0), 34.3, 23.7 + (side > 0 ? 0.6 : 0), 0, side]);
  }
  box(t.x - 12.7, t.x + 12.7, t.z - 7.2, t.z + 7.2);
  box(tr.x - 5.9, tr.x + 5.9, tr.z - 3.9, tr.z + 3.9);
  box(st.x - 1.1, st.x + 1.1, st.z - 1.1, st.z + 1.1);
  box(al.x - 2.0, al.x + 1.3, al.z - 3.1, al.z + 3.1);
  const length = edges.reduce((sum, [x0, z0, x1, z1]) => sum + Math.hypot(x1 - x0, z1 - z0), 0);
  const count = 420;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const tint = new THREE.Color();
  // Grey-green thyme, olive-green grass, straw
  const colours = [0x737c58, 0x858b62, 0x9a9060, 0xb0a06a].map((c) => new THREE.Color(c));
  let s = 31;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let placed = 0;
  const put = (x: number, z: number) => {
    // Not on the breakable ground: they'd hang over a crater
    if (placed >= count || within(AREAS, x, z, 0.1)) return;
    const w = 0.14 + rand() ** 1.5 * 0.22;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6);
    m.compose(new THREE.Vector3(x, terrain(x, z), z), q, new THREE.Vector3(w, w * (0.8 + rand() * 0.6), w));
    mesh.setMatrixAt(placed, m);
    mesh.setColorAt(placed, tint.copy(colours[Math.floor(rand() * colours.length)]).multiplyScalar(0.85 + rand() * 0.3));
    placed++;
  };
  for (let i = 0; i < 300; i++) {
    // Along the edges, in little clumps
    let u = rand() * length;
    const e = edges.find(([x0, z0, x1, z1]) => (u -= Math.hypot(x1 - x0, z1 - z0)) < 0) ?? edges[0];
    const f = rand();
    const off = 0.08 + rand() ** 2 * 0.5;
    const [x, z] = [e[0] + (e[2] - e[0]) * f + e[4] * off, e[1] + (e[3] - e[1]) * f + e[5] * off];
    for (let c = 1 + Math.floor(rand() * 3); c > 0; c--) put(x + (rand() - 0.5) * 0.35, z + (rand() - 0.5) * 0.35);
  }
  // Round the tholos's steps
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const d = 6.7 + rand() ** 2 * 0.5;
    put(th.x + Math.cos(a) * d, th.z + Math.sin(a) * d);
  }
  mesh.count = placed;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.name = 'temple:tufts';
  return mesh;
}

/** Two small boats far out on the sea, their sails catching the sun. */
function boats(): THREE.Group {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardNodeMaterial({ color: 0x3a3430, roughness: 0.8 });
  const sail = new THREE.MeshStandardNodeMaterial({ color: 0xf2ece0, roughness: 0.9, side: THREE.DoubleSide });
  const sailShape = new THREE.BufferGeometry();
  sailShape.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.6, -2.2, 0, 7.5, 0.2, 0, 0.6, 2.4], 3));
  sailShape.computeVertexNormals();
  for (const [x, z, turn] of [
    [-210, -150, 0.6],
    [-330, 40, 2.2],
  ]) {
    const boat = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 6), hull);
    body.position.y = 0.2;
    const s1 = new THREE.Mesh(sailShape, sail);
    boat.add(body, s1);
    boat.position.set(x, SEA, z);
    boat.rotation.y = turn;
    boat.name = 'temple:boat';
    g.add(boat);
  }
  return g;
}

/**
 * The physics: the plateau as boxes (the bed under the breakable ground: ground.ts), and where the
 * land falls away (the cliffs, the slopes) fixed hulls following it, so what's thrown off the edge tumbles down the rock. Cells of 8 m where
 * the land is gentle, 4 m where it isn't; down the cliffs only along the coasts the sanctuary
 * overlooks, and only to the water (what reaches it is taken out). Each cell is a column down to 2
 * m under its lowest corner, cut into bands no taller than BAND: no body much bigger than a few
 * metres, so the solver's broadphase stays fine-grained.
 */
function physics(world: World): void {
  plateau(world);
  const BAND = 10;
  const floor = SEA - 2;
  const h = (x: number, z: number) => Math.max(floor, terrain(x, z));
  const cell = (x: number, z: number, size: number) => {
    const corners: V3[] = [
      [x, h(x, z), z],
      [x + size, h(x + size, z), z],
      [x, h(x, z + size), z + size],
      [x + size, h(x + size, z + size), z + size],
    ];
    const ys = corners.map((c) => c[1]);
    const [lo, hi] = [Math.min(...ys) - 2, Math.max(...ys)];
    // The plateau's box has it; under the water nothing's needed
    const inside = x >= -34 && x + size <= 40 && z >= -30 && z + size <= 30;
    if ((inside && ys.every((y) => Math.abs(y) < 0.02)) || ys.every((y) => y <= floor + 0.01)) return;
    // A cliff face the sanctuary doesn't overlook: nothing thrown reaches it
    if (Math.min(...ys) < -6 && (z >= 45 || x >= 45)) return;
    const column = hullConvex([...corners, ...corners.map(([cx, , cz]): V3 => [cx, lo, cz])]);
    const bands = Math.ceil((hi - lo) / BAND);
    for (let i = 0; i < bands; i++) {
      const [b0, b1] = [lo + ((hi - lo) * i) / bands, lo + ((hi - lo) * (i + 1)) / bands];
      let band: Convex | null = column;
      if (i > 0) band = band && clip(band, [0, -1, 0], -b0);
      if (i < bands - 1) band = band && clip(band, [0, 1, 0], b1);
      if (band) world.addHull({ points: band.faces.flatMap((f) => f.pts).flat(), fixed: true, friction: 0.8 });
    }
  };
  for (let x = -84; x < 76; x += 8)
    for (let z = -84; z < 76; z += 8) {
      const ys: number[] = [];
      for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) ys.push(h(x + 4 * i, z + 4 * j));
      // Beside the sanctuary only where the land is all but flat (rubble lands there)
      const near = x + 8 > -45 && x < 45 && z + 8 > -40 && z < 38;
      if (Math.max(...ys) - Math.min(...ys) < (near ? 0.6 : 1.5)) cell(x, z, 8);
      else for (const [dx, dz] of [[0, 0], [4, 0], [0, 4], [4, 4]]) cell(x + dx, z + dz, 4);
    }
}
