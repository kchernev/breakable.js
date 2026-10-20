import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// The gun's view model as the game takes it (public/packs/kit/models/gun.glb and index.json's gun,
// made by scripts/assets/packs/kit/view-models.py): what gun.ts needs from it, so a rebuild that loses
// the magazine or leaves a point behind fails here, not quietly in the game.

type V3 = [number, number, number];
interface Gltf {
  scenes: Array<{ nodes: number[] }>;
  nodes: Array<{ name: string; mesh?: number; children?: number[]; translation?: V3; rotation?: number[]; scale?: V3 }>;
  meshes: Array<{ primitives: Array<{ attributes: { POSITION: number }; indices: number }> }>;
  accessors: Array<{ bufferView: number; byteOffset?: number; count: number; min?: number[]; max?: number[] }>;
  bufferViews: Array<{ byteOffset?: number; byteStride?: number }>;
}

const MODELS = new URL('../public/packs/kit/models/', import.meta.url);
const entry = JSON.parse(readFileSync(new URL('index.json', MODELS), 'utf8')).gun as { file: string; muzzle: V3; eject: V3; triangles: number };
const file = readFileSync(new URL(entry.file, MODELS));
// A GLB: a 12-byte header, then the JSON chunk and the binary one (each with an 8-byte header)
const jsonLength = file.readUInt32LE(12);
const gltf = JSON.parse(file.toString('utf8', 20, 20 + jsonLength)) as Gltf;
const bin = 20 + jsonLength + 8;
const node = (name: string) => gltf.nodes.find((n) => n.name === name);

/** A mesh's vertices (its node's frame). */
function positions(mesh: number): V3[] {
  const a = gltf.accessors[gltf.meshes[mesh].primitives[0].attributes.POSITION];
  const view = gltf.bufferViews[a.bufferView];
  assert.ok(view.byteStride === undefined || view.byteStride === 12);
  const at = bin + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return Array.from({ length: a.count }, (_, i) => [0, 1, 2].map((k) => file.readFloatLE(at + 12 * i + 4 * k)) as V3);
}

test("the gun is a node of its own at the file's origin, its magazine a child of it", () => {
  const gun = node('gun');
  assert.ok(gun?.mesh !== undefined);
  assert.ok(gltf.scenes[0].nodes.includes(gltf.nodes.indexOf(gun)));
  // The points in index.json are in the gun's frame, which is the file's
  assert.equal(gun.translation ?? gun.rotation ?? gun.scale, undefined);
  const mag = node('magazine');
  assert.ok(mag?.mesh !== undefined);
  assert.ok(gun.children?.includes(gltf.nodes.indexOf(mag)));
  // Seated under the receiver ahead of the grip, its origin the middle of its top (it hangs below it)
  const [, y, z] = mag.translation!;
  assert.ok(y < -0.02 && z < -0.05, `magazine at ${mag.translation}`);
  assert.ok(gltf.accessors[gltf.meshes[mag.mesh].primitives[0].attributes.POSITION].max![1] < 0.002);
});

test("the muzzle is on the barrel's axis at the front of the gun", () => {
  const [x, y, z] = entry.muzzle;
  assert.deepEqual([x, y], [0, 0]);
  const front = gltf.accessors[gltf.meshes[node('gun')!.mesh!].primitives[0].attributes.POSITION].min![2];
  assert.ok(Math.abs(z - front) < 0.001, `muzzle z ${z}, the gun's front ${front}`);
});

test("the ejection port is on the receiver's right side, open to +X", () => {
  const e = entry.eject;
  const v = positions(node('gun')!.mesh!);
  const near = v.filter((p) => Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]) < 0.015);
  // On the gun's right side, not in the air beside it
  assert.ok(e[0] > 0 && near.length > 0, `nothing of the gun within 1.5 cm of ${e}`);
  // Over a hole in it (the port's floor 5 mm or more in), not on the flat side ahead of or behind it
  assert.ok(near.some((p) => p[0] < e[0] - 0.005), `no port at ${e}`);
  // Nothing of it stands out past the port's face in front of it: the casings come out freely
  const ahead = v.filter((p) => Math.abs(p[1] - e[1]) < 0.015 && Math.abs(p[2] - e[2]) < 0.03 && p[0] > e[0] + 0.002);
  assert.equal(ahead.length, 0, `${ahead.length} vertices stand out in front of the port`);
});

test("index.json counts its triangles, within a view model's budget", () => {
  const triangles = gltf.meshes.reduce((n, m) => n + m.primitives.reduce((k, p) => k + gltf.accessors[p.indices].count / 3, 0), 0);
  assert.equal(entry.triangles, triangles);
  assert.ok(triangles < 30000, `${triangles} triangles`);
  assert.ok(file.length < 4e6, `${file.length} bytes`);
});

/** The settings a script's glTF export passes, as written (view-models.py's pp['NAME'] read as process-props.py's NAME). */
function exportSettings(script: string): string[] {
  const src = readFileSync(new URL(script, import.meta.url), 'utf8');
  const call = src.slice(src.indexOf('bpy.ops.export_scene.gltf(') + 'bpy.ops.export_scene.gltf('.length);
  return call
    .slice(0, call.indexOf('\n  )'))
    .split(',')
    .map((s) => s.trim().replace(/=pp\['(\w+)'\]$/, '=$1'))
    .filter(Boolean);
}

test("the view models are exported with the props' settings", () => {
  // view-models.py's export is process-props.py's, also taking the object's children
  const props = exportSettings('../scripts/assets/process-props.py');
  assert.ok(props.includes("export_format='GLB'"));
  assert.deepEqual(exportSettings('../scripts/assets/packs/kit/view-models.py'), props);
});
