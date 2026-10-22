// Towers that stand as scenery until something reaches them (Destruction.addDormant): a box each,
// drawn with a facade shader, solid as a fixed box, and stacked in sections (a dormant thing each)
// so a round or a blast wakes only the section it reaches, which stands on those under it, still
// scenery. Woken, a section is its walls in panels (a bay wide, a storey high) and,
// if it's the top, its roof; the panels' look is the scenery's own, read from each panel's map
// coordinates (laid in the world's frame: where it stood) and its tint (the tower's tone), so
// nothing changes as it wakes. A section over one that gives way under it wakes too (the library
// wakes what's dormant on pieces that go). A world gives the layout and the facade (FacadeLook);
// Brick Street's towers round the street, Neon Alley's blocks round the alley.

import { abs, attribute, float, mix, normalWorld, positionWorld, select, sign, uv, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { Body, World } from 'three-avbd';
import { type BreakableMaterial, type Destruction, type MaterialOptions, pieceFrame, pieceTint, presets } from '../lib/index.ts';

type Float = THREE.Node<'float'>;
type Vec3 = THREE.Node<'vec3'>;

/** A tower: its footprint's middle and size (x by z), its height, its tone (the facade's colour). */
export interface TowerSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  tone: THREE.ColorRepresentation;
}

/**
 * A facade at `along` (m along it: world z on a face looking along x, x on one looking along z) and
 * `y`, on a tower of `tone`, on its sides or its `top`: its colour before its tone, how much of it
 * takes the tone (0–1: the wall, not the glass), what glows (lit windows) and how rough it is.
 */
export type FacadeLook = (p: { along: Float; y: Float; tone: Vec3; top: THREE.Node<'bool'> }) => { color: Vec3; toned: Float; emissive?: Vec3; roughness?: Float };

export interface TowerOptions {
  /** A panel's height (a storey, m) and about its width (a bay); a section's height; a wall's thickness. */
  storey: number;
  bay: number;
  section: number;
  wall: number;
  /** The pieces' material (a key of the world's materials: towers.material() made). */
  material: string;
  name?: string;
  shadows?: boolean;
}

interface Section {
  y0: number;
  y1: number;
  index: number;
  body: Body;
}

/** A facade's pieces' maps are laid in the world's frame (uvScale 1): their coordinates are where they stood. */
export const WORLD_FRAME = { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0, 1] as [number, number, number, number] };

export class Towers {
  readonly list: Array<TowerSpec & { sections: Section[] }> = [];
  readonly mesh: THREE.InstancedMesh;
  private readonly options: TowerOptions;
  private readonly look: FacadeLook;

  /** The towers as scenery (one instanced draw, a box a section) and as fixed boxes in the world, a box a section. */
  constructor(scene: THREE.Scene, world: World, specs: TowerSpec[], look: FacadeLook, options: TowerOptions) {
    this.options = options;
    this.look = look;
    const { section } = options;
    const count = specs.reduce((n, t) => n + Math.ceil(t.h / section - 1e-6), 0);
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.standIn(), Math.max(1, count));
    const tones = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 3), 3);
    mesh.geometry.setAttribute('tone', tones);
    let i = 0;
    const m = new THREE.Matrix4();
    for (const t of specs) {
      const tone = new THREE.Color(t.tone);
      const tower = { ...t, sections: [] as Section[] };
      for (let y0 = 0; y0 < t.h - 1e-6; y0 += section) {
        const y1 = Math.min(t.h, y0 + section);
        m.compose(new THREE.Vector3(t.x, (y0 + y1) / 2, t.z), new THREE.Quaternion(), new THREE.Vector3(t.w, y1 - y0, t.d));
        mesh.setMatrixAt(i, m);
        tones.setXYZ(i, tone.r, tone.g, tone.b);
        const body = world.addBox({ size: [t.w, y1 - y0, t.d], position: [t.x, (y0 + y1) / 2, t.z], fixed: true, friction: 0.8 })!;
        tower.sections.push({ y0, y1, index: i, body });
        i++;
      }
      this.list.push(tower);
    }
    mesh.count = count;
    mesh.castShadow = options.shadows ?? true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.name = `scenery:${options.name ?? 'towers'}`;
    scene.add(mesh);
    this.mesh = mesh;
  }

  /**
   * Each tower's sections as dormant things (once the Destruction is made): woken, a section's
   * stand-in goes and it's built. `along(tower, section)`: what else goes with a section and is
   * built with it (a sign on its face).
   */
  dormant(d: Destruction, along?: (tower: TowerSpec, y0: number, y1: number) => { hide?: () => void; build?: (d: Destruction) => void }): void {
    for (const t of this.list) {
      for (const sec of t.sections) {
        const extra = along?.(t, sec.y0, sec.y1);
        d.addDormant({
            name: this.options.name ?? 'tower',
            bounds: { min: [t.x - t.w / 2, sec.y0, t.z - t.d / 2], max: [t.x + t.w / 2, sec.y1, t.z + t.d / 2] },
            bodies: [sec.body],
            hide: () => {
              this.hide(sec.index);
              extra?.hide?.();
            },
            build: (dd) => {
              this.build(dd, t, sec.y0, sec.y1, sec.y1 >= t.h - 1e-6);
              extra?.build?.(dd);
            },
          });
      }
    }
  }

  /**
   * The pieces' material: a preset (default concrete's) with the facade read from each panel's map
   * coordinates and its tint, the tone where `toned` says, lit windows going dark once it's loose.
   */
  material(options: MaterialOptions = {}, preset: (o: MaterialOptions) => BreakableMaterial = presets.concrete): BreakableMaterial {
    // (Walls of panels with no floors or frames behind them: as strong as a building's, so a hole holds as under a lintel)
    return facadeMaterial(this.look, { fragmentSize: 0.7, maxPieces: 10, support: 600, ...options }, preset);
  }

  /** The scenery's look: the same facade, each section's tone an attribute of its instance. */
  private standIn(): THREE.MeshStandardNodeMaterial {
    return facadeStandIn(this.look);
  }

  private hide(index: number): void {
    this.mesh.setMatrixAt(index, new THREE.Matrix4().makeScale(0, 0, 0));
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** A section's walls, panel by panel, and its roof if it's the top. */
  private build(d: Destruction, t: TowerSpec, y0: number, y1: number, top: boolean): void {
    const { storey, bay, wall, material } = this.options;
    const rows: Array<[number, number]> = [];
    for (let y = y0; y < y1 - 1e-6; y += storey) rows.push([y, Math.min(y1, y + storey)]);
    // (A sliver at the top goes with the row under it)
    if (rows.length > 1 && rows[rows.length - 1][1] - rows[rows.length - 1][0] < 0.5) rows[rows.length - 2][1] = rows.pop()![1];
    const tint = new THREE.Color(t.tone);
    const panel = (size: [number, number, number], position: [number, number, number]) => d.addBox({ material, size, position, tint, textureFrame: WORLD_FRAME });
    for (const [a, b] of rows) {
      const h = b - a;
      const y = (a + b) / 2;
      // The faces along x whole; the ends between them
      for (const side of [1, -1]) {
        const n = Math.max(1, Math.round(t.w / bay));
        const cw = t.w / n;
        for (let c = 0; c < n; c++) panel([cw, h, wall], [t.x - t.w / 2 + cw * (c + 0.5), y, t.z + side * (t.d / 2 - wall / 2)]);
        const len = t.d - 2 * wall;
        const m = Math.max(1, Math.round(len / bay));
        const cd = len / m;
        for (let c = 0; c < m; c++) panel([wall, h, cd], [t.x + side * (t.w / 2 - wall / 2), y, t.z - len / 2 + cd * (c + 0.5)]);
      }
    }
    if (!top) return;
    // The roof inside the walls, in slabs of up to 2.6 m
    const iw = t.w - 2 * wall;
    const id = t.d - 2 * wall;
    const nx = Math.max(1, Math.ceil(iw / 2.6));
    const nz = Math.max(1, Math.ceil(id / 2.6));
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) panel([iw / nx, 0.3, id / nz], [t.x - iw / 2 + (iw / nx) * (i + 0.5), y1 - 0.15, t.z - id / 2 + (id / nz) * (k + 0.5)]);
  }
}

/**
 * A facade's pieces' material: `preset` with the facade read from each piece's map coordinates (laid
 * in the world's frame, uvScale 1: where it stood, box-projected) and its tint (the tone), which
 * goes where `toned` says; what glows goes dark once it's loose. Its pieces are given
 * `textureFrame: WORLD_FRAME`.
 */
export function facadeMaterial(look: FacadeLook, options: MaterialOptions, preset: (o: MaterialOptions) => BreakableMaterial): BreakableMaterial {
  const surface = new THREE.MeshStandardNodeMaterial({ roughness: 0.85 });
  const { normal } = pieceFrame();
  const t = uv();
  const side = abs(normal.x).greaterThan(0.5);
  // (Box-projected: a face looking along ±x has u = ∓z, one along ±z has u = ±x; v is y)
  const along = select(side, t.x.mul(sign(normal.x).negate()), t.x.mul(sign(normal.z)));
  const top = abs(normal.y).greaterThan(0.5);
  const f = look({ along, y: t.y, tone: pieceTint(), top });
  surface.colorNode = f.color as unknown as THREE.Node<'color'>;
  if (f.emissive) surface.emissiveNode = f.emissive as unknown as THREE.Node<'color'>;
  if (f.roughness) surface.roughnessNode = f.roughness;
  return preset({ ...options, surface, tintMask: f.toned, glow: f.emissive ? 'standing' : undefined, uvScale: 1, uvJitter: 0 });
}

/** The same facade on scenery in the world's frame, its tone a `tone` attribute (per instance or per vertex). */
export function facadeStandIn(look: FacadeLook): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.85 });
  const side = abs(normalWorld.x).greaterThan(0.5);
  const along = select(side, positionWorld.z, positionWorld.x);
  const top = abs(normalWorld.y).greaterThan(0.5);
  const tone = attribute<'vec3'>('tone', 'vec3');
  const f = look({ along, y: positionWorld.y, tone, top });
  m.colorNode = f.color.mul(mix(vec3(1), tone, f.toned)) as unknown as THREE.Node<'color'>;
  if (f.emissive) m.emissiveNode = f.emissive as unknown as THREE.Node<'color'>;
  m.roughnessNode = f.roughness ?? float(0.85);
  return m;
}
