// Where an asset pack's lists, raw generations and finished files live. Without PACK, the base pack:
// the lists in scripts/assets (sounds.mjs, textures.mjs, props.mjs), raws in assets-src/<kind>, and
// the finished files in public/sounds, public/textures, public/models. With PACK=<name> (a world's
// own pack), the lists in scripts/assets/packs/<name>/, raws in assets-src/packs/<name>/<kind>, and
// the finished files in public/packs/<name>/<sounds|textures|models>.

const ROOT = new URL('../../', import.meta.url).pathname;
export const PACK = process.env.PACK || null;

const OUT = { sounds: 'sounds', textures: 'textures', props: 'models' };

/** The pack's list of `kind` ('sounds' | 'textures' | 'props'), as a module path. */
export const manifest = (kind) => (PACK ? `${ROOT}scripts/assets/packs/${PACK}/${kind}.mjs` : `${ROOT}scripts/assets/${kind}.mjs`);
/** Where the raw generations of `kind` go (with a trailing slash). */
export const rawDir = (kind) => (PACK ? `${ROOT}assets-src/packs/${PACK}/${kind}/` : `${ROOT}assets-src/${kind}/`);
/** Where the finished files of `kind` go (with a trailing slash). */
export const outDir = (kind) => (PACK ? `${ROOT}public/packs/${PACK}/${OUT[kind]}/` : `${ROOT}public/${OUT[kind]}/`);
