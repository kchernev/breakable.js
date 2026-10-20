import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { hullConvex, type V3 } from '../src/lib/index.ts';

// process-props.py's colliders, fitted to made-up models by the script's own functions in Blender
// (in the background; skipped where there's none: BLENDER, or ~/.local/bin/blender)
const BLENDER = process.env.BLENDER ?? `${homedir()}/.local/bin/blender`;
const SCRIPT = fileURLToPath(new URL('../scripts/assets/process-props.py', import.meta.url));
const skip = !existsSync(BLENDER) && 'no Blender';

const MODELS = `
def cylinder(axis, r=0.5, length=0.9, n=32):
  """Round about x, y or z, its bottom at y = 0."""
  pts = []
  for t in (0, length):
    for k in range(n):
      a = 2 * math.pi * k / n
      c, s = r * math.cos(a), r * math.sin(a)
      pts.append({'x': (t, r + c, s), 'y': (c, t, s), 'z': (c, r + s, t)}[axis])
  return np.array(pts)

def car():
  """A body on four wheels that touch the ground along a line each."""
  pts = [(x, y, z) for x in (-0.9, 0.9) for y in (0.3, 1.4) for z in (-2.3, 2.3)]
  for x in (-0.8, 0.8):
    for z in (-1.5, 1.5):
      for k in range(16):
        a = 2 * math.pi * k / 16
        pts += [(x + dx, 0.3 + 0.3 * math.cos(a), z + 0.3 * math.sin(a)) for dx in (-0.1, 0.1)]
  return np.array(pts)

def forklift():
  """A body standing on the ground, and two forks out in front of it, low."""
  box = lambda x0, x1, y0, y1, z0, z1: [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
  return np.array(box(-0.6, 0.6, 0, 2, -1, 1.2) + box(-0.4, -0.3, 0.05, 0.1, -2.2, -1) + box(0.3, 0.4, 0.05, 0.1, -2.2, -1))

BODY = {'box': [[-1, -1, -1.01], [1, 3, 1.3]]}
FORKS = [{'box': [[-0.5, 0, -2.3], [-0.2, 0.2, -0.99]]}, {'box': [[0.2, 0, -2.3], [0.5, 0.2, -0.99]]}]
out = {}
for name, v, prop in [('x', cylinder('x'), {'round': 'x'}), ('y', cylinder('y'), {'round': 'y'}), ('z', cylinder('z'), {'round': 'z'}),
                      ('hexagon', cylinder('y'), {'round': 'y', 'sides': 6}), ('car', car(), {}), ('forklift', forklift(), {'name': 'forklift', 'parts': [BODY] + FORKS})]:
  fields, worst, cover = pp['collider'](v, prop)
  out[name] = {**fields, 'model': v.tolist()}
print('RESULT ' + json.dumps(out))
`;

type Fit = { collider: V3[]; colliders?: V3[][]; hullVertices?: number; model: V3[] };

function fit(): Record<string, Fit> {
  const expr = `import json, math, runpy\nimport numpy as np\npp = runpy.run_path(${JSON.stringify(SCRIPT)}, run_name='process_props')\n${MODELS}`;
  const out = execFileSync(BLENDER, ['-b', '--factory-startup', '--python-exit-code', '1', '--python-expr', expr], { encoding: 'utf8' });
  return JSON.parse(out.split('\n').find((l) => l.startsWith('RESULT '))!.slice(7));
}

/** How far the farthest of `points` lies outside the hull of `of`. */
const outside = (of: V3[], points: V3[]) => {
  const hull = hullConvex(of)!;
  return Math.max(...points.map((p) => Math.max(...hull.faces.map((f) => f.n[0] * p[0] + f.n[1] * p[1] + f.n[2] * p[2] - f.d))));
};

test("process-props.py's colliders rest on a face of the model's bottom, round or standing", { skip }, () => {
  const fits = fit();
  for (const [name, { collider, hullVertices, model }] of Object.entries(fits)) {
    if (name === 'forklift') continue;
    // A round one is a 16-sided prism (it rolls), and says Destruction should keep all its corners
    const most = name === 'car' || name === 'hexagon' ? 12 : 32;
    assert.ok(collider.length <= most, `${name}: ${collider.length} points (Destruction would pick ${most} itself)`);
    assert.equal(hullVertices, most > 12 ? collider.length : undefined, `${name}: hullVertices`);
    // Its lowest points are the model's, and there are three or more of them (a face, not an edge)
    const floor = Math.min(...collider.map((p) => p[1]));
    assert.ok(Math.abs(floor - Math.min(...model.map((p) => p[1]))) < 1e-3, `${name}: collider bottom ${floor}`);
    const ground = collider.filter((p) => p[1] < floor + 1e-6).length;
    assert.ok(ground >= (name === 'car' ? 3 : 4), `${name}: ${ground} points on the ground`);
    // A round one holds the whole model (each face touches its circle)
    if (name !== 'car') assert.ok(outside(collider, model) < 2e-3, `${name}: a vertex ${outside(collider, model)} m outside`);
  }
});

test("process-props.py fits a prop's parts each a hull (the solver's colliders), the first its main body", { skip }, () => {
  const { collider, colliders, hullVertices, model } = fit().forklift;
  assert.ok(colliders && colliders.length === 3, 'a hull for each part');
  assert.equal(hullVertices, undefined);
  // The body: the model's body, standing on the ground; the forks, low in front of it
  const [body, ...forks] = colliders;
  assert.ok(Math.min(...body.map((p) => p[2])) > -1.01 && Math.min(...body.map((p) => p[1])) === 0, 'the body');
  for (const fork of forks) {
    assert.ok(fork.length >= 4 && fork.length <= 12, `${fork.length} points`);
    assert.ok(Math.max(...fork.map((p) => p[1])) <= 0.1 && Math.min(...fork.map((p) => p[2])) <= -2.2, 'a fork');
  }
  // Every vertex of the model is in a part; `collider` is the hull of them all
  for (const p of model) assert.ok(Math.min(...colliders.map((c) => outside(c, [p]))) < 1e-3, `${p} in no part`);
  assert.ok(outside(collider, colliders.flat()) < 1e-3 && outside(colliders.flat(), collider) < 1e-3, 'collider: the parts together');
});
