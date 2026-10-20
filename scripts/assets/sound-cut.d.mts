// sound-cut.mjs's types, for the tests that import it.

type Channels = Float32Array[];

export const RATE: number;
export function mono(ch: Channels): Channels;
export function trim(ch: Channels): Channels;
export function onset(ch: Channels, db: number): Channels;
export function fade(ch: Channels, fin: number, fout: number): Channels;
export function place(ch: Channels, parts: Array<[number, number, number]>): Channels;
export function loop(ch: Channels, cut: number, x: number): Channels;
export function slices(ch: Channels, most?: number): Array<{ ch: Channels; at: number }>;
export function level(ch: Channels, target: number): Channels;
