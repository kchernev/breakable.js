// Flat ground that stands as scenery until a blast reaches it, round a world's breakable ground:
// tiles, each a fixed box in the world (its top the ground's) until then; a blast reaching one lays
// it as breakable ground there (Destruction.addDormant, then addGround: the layers the world says,
// on a bed its box goes down to), and the drawn ground is cut away over it (hole(): what the world's
// ground material discards by). Where a woken tile meets one still dormant, a wall of the pit's
// side is drawn down to the bed, so a crater at its edge shows earth, not the void under the
// drawn ground. Rounds strike the dormant ground as the scenery it is. The tiles are a grid over
// the area, cut evenly or also along given lines (where other ground meets it: `cuts`); tiles under
// what mustn't sink can be left as they are (dormant()'s `stay`).

import { step, texture, vec2 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { Body, World } from 'three-avbd';
import type { Destruction, GroundOptions } from '../lib/index.ts';

type Area = [number, number, number, number];

export interface DormantGroundOptions {
  /** All of it, seen from above ([x0, z0, x1, z1]), in tiles about `tile` across. */
  area: Area;
  tile: number;
  /**
   * Lines across it the tiles are cut along besides (x, z): where other ground meets it, so a tile
   * ends where that begins. Between them a stretch wider than `tile` is cut evenly.
   */
  cuts?: { xs: number[]; zs: number[] };
  /** Its surface's height, and where the box under a tile reaches down to. */
  top: number;
  bottom: number;
  /** Tiles left out (a breakable ground there already, a building's footprint, the water), by area. */
  skip?: (area: Area) => boolean;
  /** The breakable ground a tile is laid as (its layers' options, for its area). */
  layers: (area: Area) => GroundOptions[];
  /** What a pit's side looks like (default: dark earth). */
  pit?: THREE.Material;
  friction?: number;
  name?: string;
}

interface Tile {
  area: Area;
  i: number;
  k: number;
  body: Body | null;
  woken: boolean;
  bed: number;
}

export class DormantGround {
  private readonly o: DormantGroundOptions;
  private readonly world: World;
  private readonly tiles: Tile[] = [];
  private readonly grid = new Map<string, Tile>();
  /** The lines the tiles are cut along (x, z), from the area's edge to its edge. */
  private readonly xs: number[];
  private readonly zs: number[];
  private readonly nx: number;
  private readonly nz: number;
  /** A tile a texel; with cuts, which tile's column and row each 5 cm across the area falls in (u, v of the mask). */
  private readonly mask: THREE.DataTexture;
  private readonly columns: THREE.DataTexture | null = null;
  private readonly rows: THREE.DataTexture | null = null;
  /** The pits' sides: a quad each edge of a woken tile against one still dormant. */
  private readonly walls: THREE.InstancedMesh;
  private readonly wallAt = new Map<string, number>();

  constructor(scene: THREE.Scene, world: World, o: DormantGroundOptions) {
    this.o = o;
    this.world = world;
    const [x0, z0, x1, z1] = o.area;
    // The lines: the area's edges and the cuts within it, each stretch between them cut evenly
    const lines = (a: number, b: number, cuts: number[] = []) => {
      const at = [...new Set([a, b, ...cuts.filter((c) => c > a + 1e-6 && c < b - 1e-6)])].sort((p, q) => p - q);
      return at.flatMap((c, i) => {
        if (i === at.length - 1) return [c];
        const n = Math.max(1, Math.round((at[i + 1] - c) / o.tile));
        return Array.from({ length: n }, (_, j) => c + ((at[i + 1] - c) * j) / n);
      });
    };
    this.xs = lines(x0, x1, o.cuts?.xs);
    this.zs = lines(z0, z1, o.cuts?.zs);
    this.nx = this.xs.length - 1;
    this.nz = this.zs.length - 1;
    for (let i = 0; i < this.nx; i++)
      for (let k = 0; k < this.nz; k++) {
        const area: Area = [this.xs[i], this.zs[k], this.xs[i + 1], this.zs[k + 1]];
        if (o.skip?.(area)) continue;
        const body = world.addBox({ size: [area[2] - area[0], o.top - o.bottom, area[3] - area[1]], position: [(area[0] + area[2]) / 2, (o.top + o.bottom) / 2, (area[1] + area[3]) / 2], fixed: true, friction: o.friction ?? 0.85 })!;
        const tile: Tile = { area, i, k, body, woken: false, bed: o.top };
        this.tiles.push(tile);
        this.grid.set(`${i},${k}`, tile);
      }
    this.mask = new THREE.DataTexture(new Uint8Array(this.nx * this.nz * 4), this.nx, this.nz, THREE.RGBAFormat);
    this.mask.magFilter = this.mask.minFilter = THREE.NearestFilter;
    this.mask.needsUpdate = true;
    if (o.cuts) {
      // (Tiles of different sizes: which column and row a point is in, looked up first)
      const index = (lines: number[], n: number) => {
        const [a, b] = [lines[0], lines[lines.length - 1]];
        const w = Math.max(1, Math.ceil((b - a) / 0.05));
        const data = new Uint8Array(w * 4);
        for (let t = 0; t < w; t++) {
          const at = a + ((t + 0.5) / w) * (b - a);
          const c = Math.max(0, Math.min(n - 1, lines.findIndex((l, j) => at >= l && at < lines[j + 1])));
          data[t * 4] = Math.round(((c + 0.5) / n) * 255);
        }
        const tex = new THREE.DataTexture(data, w, 1, THREE.RGBAFormat);
        tex.magFilter = tex.minFilter = THREE.NearestFilter;
        tex.needsUpdate = true;
        return tex;
      };
      if (this.nx > 255 || this.nz > 255) throw new Error('DormantGround: more than 255 tiles across with cuts');
      this.columns = index(this.xs, this.nx);
      this.rows = index(this.zs, this.nz);
    }
    const pit = o.pit ?? new THREE.MeshStandardNodeMaterial({ color: 0x5a4a3a, roughness: 1 });
    this.walls = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), pit, Math.max(4, this.tiles.length * 4));
    this.walls.count = 0;
    this.walls.frustumCulled = false;
    this.walls.receiveShadow = true;
    this.walls.name = `scenery:${o.name ?? 'ground'} pits`;
    scene.add(this.walls);
  }

  /**
   * The tiles as dormant things (in build: the Destruction is made), but those `stay` says are to
   * stand as they are (under something that mustn't sink): their boxes stay, and never wake.
   */
  dormant(d: Destruction, stay?: (area: Area) => boolean): void {
    for (const t of this.tiles) {
      if (stay?.(t.area)) continue;
      const [x0, z0, x1, z1] = t.area;
      d.addDormant({
        name: this.o.name ?? 'ground',
        blastOnly: true,
        bounds: { min: [x0, this.o.bottom, z0], max: [x1, this.o.top, z1] },
        bodies: t.body ? [t.body] : [],
        build: (dd) => this.wake(dd, t),
      });
    }
  }

  /** 1 where the ground has been laid breakable (the drawn ground goes there), by (x, z). */
  hole(xz: THREE.Node<'vec2'>): THREE.Node<'float'> {
    const [x0, z0, x1, z1] = this.o.area;
    const at = xz.sub(vec2(x0, z0)).div(vec2(x1 - x0, z1 - z0));
    // Off the area: no hole (the mask's edge texels would carry on out past it)
    const on = step(0, at.x).mul(step(at.x, 1)).mul(step(0, at.y)).mul(step(at.y, 1));
    if (!this.columns || !this.rows) return texture(this.mask, at).r.mul(on);
    return texture(this.mask, vec2(texture(this.columns, vec2(at.x, 0.5)).r, texture(this.rows, vec2(at.y, 0.5)).r)).r.mul(on);
  }

  /** Cut `material`'s drawn ground away where it has been laid breakable (by its fragments' x and z). */
  cut(material: THREE.MeshStandardNodeMaterial, xz: THREE.Node<'vec2'>): void {
    material.opacityNode = this.hole(xz).oneMinus();
    material.alphaTest = 0.5;
  }

  /** The bed's height where it has been laid breakable at (x, z) (the world's groundAt there), else null. */
  bedAt(x: number, z: number): number | null {
    const i = this.xs.findIndex((l, j) => x >= l && x < this.xs[j + 1]);
    const k = this.zs.findIndex((l, j) => z >= l && z < this.zs[j + 1]);
    const t = i >= 0 && k >= 0 ? this.grid.get(`${i},${k}`) : undefined;
    return t?.woken ? t.bed : null;
  }

  private wake(d: Destruction, t: Tile): void {
    t.woken = true;
    let bed = this.o.top;
    for (const g of this.o.layers(t.area)) bed = Math.min(bed, d.addGround(g).bed);
    t.bed = bed;
    // Under its bed, the box it stood on (cut down to there)
    const [x0, z0, x1, z1] = t.area;
    if (bed > this.o.bottom + 0.01) this.world.addBox({ size: [x1 - x0, bed - this.o.bottom, z1 - z0], position: [(x0 + x1) / 2, (bed + this.o.bottom) / 2, (z0 + z1) / 2], fixed: true, friction: this.o.friction ?? 0.85 });
    const data = this.mask.image.data as Uint8Array;
    data[(t.k * this.nx + t.i) * 4] = 255;
    this.mask.needsUpdate = true;
    this.pits(t);
  }

  /** Its sides against tiles still dormant walled; the walls between it and woken ones gone. */
  private pits(t: Tile): void {
    const [x0, z0, x1, z1] = t.area;
    const sides: Array<[number, number, [number, number, number], number, number]> = [
      [-1, 0, [x0, 0, (z0 + z1) / 2], Math.PI / 2, z1 - z0],
      [1, 0, [x1, 0, (z0 + z1) / 2], -Math.PI / 2, z1 - z0],
      [0, -1, [(x0 + x1) / 2, 0, z0], 0, x1 - x0],
      [0, 1, [(x0 + x1) / 2, 0, z1], Math.PI, x1 - x0],
    ];
    const m = new THREE.Matrix4();
    for (const [di, dk, at, turn, len] of sides) {
      const n = this.grid.get(`${t.i + di},${t.k + dk}`);
      const key = (a: Tile, b: Tile) => `${Math.min(a.i, b.i)},${Math.min(a.k, b.k)},${Math.max(a.i, b.i)},${Math.max(a.k, b.k)}`;
      if (n?.woken) {
        // (Both laid now: no side between them)
        const w = this.wallAt.get(key(t, n));
        if (w !== undefined) {
          this.walls.setMatrixAt(w, m.makeScale(0, 0, 0));
          this.walls.instanceMatrix.needsUpdate = true;
        }
        continue;
      }
      if (this.walls.count >= this.walls.instanceMatrix.count) continue;
      const h = this.o.top - t.bed;
      // Facing into the woken tile, from its bed to the top
      m.compose(new THREE.Vector3(at[0], t.bed + h / 2, at[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, turn, 0)), new THREE.Vector3(len, h, 1));
      const index = this.walls.count++;
      this.walls.setMatrixAt(index, m);
      this.walls.instanceMatrix.needsUpdate = true;
      if (n) this.wallAt.set(key(t, n), index);
    }
  }
}
