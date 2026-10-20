// The demo's texture sets without a browser: an image element stood in for, its arrival by hand.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { repeat, textured } from '../src/demo/textures.ts';

/** An <img> as three's ImageLoader uses it: listeners, and a load the test sets off. */
class FakeImage {
  complete = false;
  width = 0;
  height = 0;
  src = '';
  crossOrigin = '';
  private readonly listeners = new Map<string, (this: FakeImage) => void>();
  addEventListener(type: string, f: (this: FakeImage) => void) {
    this.listeners.set(type, f);
  }
  removeEventListener(type: string) {
    this.listeners.delete(type);
  }
  arrive() {
    this.complete = true;
    this.width = this.height = 1024;
    this.listeners.get('load')?.call(this);
  }
}
const images: FakeImage[] = [];
const createElementNS = () => {
  const image = new FakeImage();
  images.push(image);
  return image;
};
Object.assign(globalThis, { document: { createElementNS } });

test("repeat()'s copies of maps still loading wait for their images, then are uploaded with them", () => {
  const m = repeat(textured('waiting_set'), 4, 2);
  const maps = [m.map!, m.normalMap!, m.roughnessMap!];
  assert.equal(images.length, 3, 'the set is loading');
  for (const c of maps) {
    assert.deepEqual(c.repeat.toArray(), [4, 2]);
    // The renderer uploads a texture whose version is over 0, reading its image: none yet
    assert.equal(c.image, null);
    assert.equal(c.version, 0, 'not marked for upload without its image');
  }
  for (const i of images) i.arrive();
  for (const c of maps) {
    assert.ok(c.version > 0, 'marked once its image is there');
    assert.ok(c.image instanceof FakeImage && c.image.complete);
  }
  // A copy of a map already there is uploaded at once; the shared map keeps its own repeat
  const again = repeat(textured('waiting_set'), 3, 3);
  assert.ok(again.map!.version > 0 && again.map!.image === maps[0].image);
  assert.deepEqual(textured('waiting_set').map!.repeat.toArray(), [1, 1]);
});
