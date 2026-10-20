// PropMesh: a model (a GLB's meshes, say) drawn on solver bodies, every copy of it in one
// instanced draw per part. Each instance reads its body's pose from the solver's buffer in the
// vertex shader, as FragmentMesh does, so a car thrown by a blast moves smoothly between readbacks.
// The model's own materials are kept (maps, roughness, metalness), with its normal map applied in
// the body's turning frame. Each copy has its own tint, over the whole model or where its colour
// map's alpha says (a pack's paint mask).

import { attribute, cross, instanceIndex, materialColor, mix, normalize, positionGeometry, saturate, storage, texture, transformNormalToView, uv, varying, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { World } from 'three-avbd';
import { B_POS, B_ROT, BODY_FLOATS } from 'three-avbd/advanced';

type Vec3 = THREE.Node<'vec3'>;
type Vec4 = THREE.Node<'vec4'>;

function rotate(q: Vec4, v: Vec3): Vec3 {
  const t = cross(q.xyz, v).mul(2);
  return v.add(t.mul(q.w)).add(cross(q.xyz, t));
}

export class PropMesh extends THREE.Group {
  readonly capacity: number;
  private readonly ids: THREE.StorageInstancedBufferAttribute;
  private readonly tints: THREE.StorageInstancedBufferAttribute;
  private readonly parts: Array<THREE.Mesh<THREE.InstancedBufferGeometry, THREE.NodeMaterial>> = [];
  /** Body slot → instance. */
  private readonly instances = new Map<number, number>();
  private readonly slots: number[] = [];

  /**
   * `model`'s meshes, with `toBody` taking the model's frame to its body's (where the body's frame
   * sits in the model's, inverted: bodies made from hulls sit at their centre of mass, on their
   * principal axes). `tintMask` 'alpha': a copy's tint goes where the colour map's alpha says.
   */
  constructor(world: World, model: THREE.Object3D, toBody: THREE.Matrix4, options: { capacity?: number; shadows?: boolean; tintMask?: 'alpha' } = {}) {
    super();
    if (!world.bodyAttribute) throw new Error('PropMesh: the world has no body attribute (create it with a renderer)');
    this.capacity = options.capacity ?? 256;
    this.ids = new THREE.StorageInstancedBufferAttribute(new Uint32Array(this.capacity), 1);
    this.tints = new THREE.StorageInstancedBufferAttribute(new Float32Array(this.capacity * 4).fill(1), 4);
    const tint = varying(storage(this.tints, 'vec4', this.capacity).toReadOnly().element(instanceIndex).xyz);
    const vec4s = BODY_FLOATS / 4;
    const bodies = storage(world.bodyAttribute, 'vec4', world.maxBodies * vec4s).toReadOnly();
    const base = storage(this.ids, 'uint', this.capacity).toReadOnly().element(instanceIndex).mul(vec4s);
    const pos = bodies.element(base.add(B_POS / 4)).xyz;
    const rot = bodies.element(base.add(B_ROT / 4)) as unknown as Vec4;

    model.updateWorldMatrix(true, true);
    const rootInverse = model.matrixWorld.clone().invert();
    model.traverse((o) => {
      const source = o as THREE.Mesh;
      if (!source.isMesh) return;
      // The part's triangles in the body's frame
      const g = source.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toBody, rootInverse.clone().multiply(source.matrixWorld)));
      const materials = Array.isArray(source.material) ? source.material : [source.material];
      const material = materials[0] as THREE.MeshStandardMaterial;
      const normalMap = material.normalMap;
      if (normalMap && !g.getAttribute('tangent') && g.index && g.getAttribute('uv')) g.computeTangents();
      const geometry = new THREE.InstancedBufferGeometry();
      geometry.index = g.index;
      for (const [name, a] of Object.entries(g.attributes)) geometry.setAttribute(name, a);
      for (const group of g.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
      geometry.instanceCount = 0;
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);

      const m = toNodeMaterial(material);
      m.positionNode = rotate(rot, positionGeometry).add(pos);
      // The copy's tint, where the mask lets it (alpha written 1/255 for none: a WebP encoder may
      // change the colour under alpha 0)
      const base = (m.colorNode ?? materialColor) as unknown as Vec4;
      const amount = options.tintMask === 'alpha' && m.map ? saturate(texture(m.map, uv()).a.sub(1 / 255).mul(255 / 254)) : null;
      m.colorNode = vec4(base.rgb.mul(amount ? mix(vec3(1, 1, 1), tint, amount) : tint), base.a) as unknown as THREE.Node<'color'>;
      const n = varying(rotate(rot, attribute<'vec3'>('normal', 'vec3')));
      let normal: Vec3 = normalize(n);
      const tangent = geometry.getAttribute('tangent') ? attribute<'vec4'>('tangent', 'vec4') : null;
      if (normalMap && tangent) {
        const t = varying(rotate(rot, tangent.xyz));
        const b = varying(rotate(rot, cross(attribute<'vec3'>('normal', 'vec3'), tangent.xyz).mul(tangent.w)));
        const s = material.normalScale ?? new THREE.Vector2(1, 1);
        const bump = texture(normalMap, uv()).xyz.mul(2).sub(1);
        normal = normalize(t.mul(bump.x.mul(s.x)).add(b.mul(bump.y.mul(s.y))).add(normalize(n).mul(bump.z)));
      }
      m.normalNode = transformNormalToView(normal);
      const part = new THREE.Mesh(geometry, m);
      part.frustumCulled = false;
      part.castShadow = part.receiveShadow = options.shadows ?? true;
      part.name = source.name;
      this.parts.push(part);
      this.add(part);
    });
  }

  /** Draw the model on body `slot`, tinted. */
  show(slot: number, tint: [number, number, number] = [1, 1, 1]): void {
    if (this.instances.has(slot)) return;
    if (this.slots.length >= this.capacity) throw new Error(`PropMesh: more than ${this.capacity} copies`);
    this.instances.set(slot, this.slots.length);
    (this.tints.array as Float32Array).set(tint, 4 * this.slots.length);
    this.slots.push(slot);
    this.sync();
  }

  /** Stop drawing the model on body `slot`. */
  hide(slot: number): void {
    const i = this.instances.get(slot);
    if (i === undefined) return;
    // The last copy takes the place of the one going
    const last = this.slots.pop()!;
    this.instances.delete(slot);
    if (last !== slot) {
      this.slots[i] = last;
      this.instances.set(last, i);
      const t = this.tints.array as Float32Array;
      t.copyWithin(4 * i, 4 * this.slots.length, 4 * this.slots.length + 4);
    }
    this.sync();
  }

  get count(): number {
    return this.slots.length;
  }

  private sync(): void {
    (this.ids.array as Uint32Array).set(this.slots);
    this.ids.needsUpdate = true;
    this.tints.needsUpdate = true;
    for (const p of this.parts) p.geometry.instanceCount = this.slots.length;
  }
}

/** A node material with a standard material's look (the loaders make plain ones). */
function toNodeMaterial(m: THREE.Material): THREE.MeshStandardNodeMaterial {
  if ((m as THREE.NodeMaterial).isNodeMaterial) return (m as THREE.MeshStandardNodeMaterial).clone();
  const s = m as THREE.MeshStandardMaterial;
  const out = new THREE.MeshStandardNodeMaterial();
  for (const key of ['color', 'map', 'roughness', 'roughnessMap', 'metalness', 'metalnessMap', 'emissive', 'emissiveMap', 'emissiveIntensity', 'aoMap', 'aoMapIntensity', 'alphaMap', 'transparent', 'opacity', 'alphaTest', 'side', 'vertexColors'] as const) {
    const v = (s as unknown as Record<string, unknown>)[key];
    if (v === undefined) continue;
    if (v && typeof (v as THREE.Color).isColor === 'boolean') (out[key as 'color'] as THREE.Color).copy(v as THREE.Color);
    else (out as unknown as Record<string, unknown>)[key] = v;
  }
  out.name = s.name;
  return out;
}
