// Brick Street's own sounds (PACK=nyc): what the street does when it's shot at. The pigeons going
// up off the roofs, an air conditioner holed, a lamp shorting out, a rooftop tank leaking. The rest
// (blasts, brick, glass, metal, the car alarm, the sirens, the hydrant's hiss) is the base pack's;
// steps.metal is made from the base pack's own takes (steps-metal.mjs).

import { NO, foley, fx, sound } from '../../sounds.mjs';

export const sounds = [
  // Wings only: alarmed pigeons hardly coo, and coos read as voices in a take. One flock at a
  // time, from wherever most of them took off; as loud in play as Market Town's birds.scatter
  {
    name: 'pigeons.scatter',
    count: 2,
    duration: 3.5,
    fade: 0.6,
    negative: `${NO}, cooing, chirping, birdsong, traffic, car horns`,
    prompt: fx('A flock of city pigeons startled off a building ledge all at once: a sudden loud burst of many wings clapping and flapping as they take off, the flock flying up and away and fading out. Outdoors in a city street.'),
    play: { near: 10, rolloff: 0.8, volume: 0.7, voices: 1, cooldown: 4, spacing: 60, reverb: 0.35 },
  },
  // A window unit shot through: once a unit. The take came as the hiss and the rattle, then the
  // clank 2 s on: laid out clank first, the hiss and rattle under it. Its level in play is under a
  // pane bursting (glass.shatter), a few dB over a strike on iron
  {
    name: 'ac.hiss',
    count: 1,
    duration: 3,
    fade: 0.5,
    parts: [[[1.96, 2.6, 0], [0, 1.25, 0.04]]],
    negative: `${NO}, explosion, gunshot, kettle, whistle, train, steam engine`,
    prompt: fx('A window air conditioner unit hit hard: a tinny metallic clank, then pressurised refrigerant gas hissing out of a punctured copper pipe, loud at first and dying away over two seconds as the fan rattles to a stop.'),
    play: { near: 4, volume: 0.9, voices: 2, cooldown: 0.3, pitch: [0.92, 1.08], reverb: 0.3 },
  },
  // A street lamp or a ceiling light knocked out of its fitting: as loud in play as Neon Alley's
  // lamp.pop
  {
    name: 'lamp.short',
    count: 1,
    duration: 1.5,
    negative: `${NO}, explosion, gunshot, thunder, buzzing hum`,
    prompt: fx('A street lamp struck and shorting out: a sharp electric pop as the bulb bursts, a crackling fizz of sparks for half a second and a light tinkle of glass, then silence.'),
    play: { near: 4, volume: 1, voices: 2, cooldown: 0.15, pitch: [0.85, 1.15], reverb: 0.3 },
  },
  // A rooftop water tank holed by the gun: water running out of the hole onto the roof (a loop at
  // the hole; two at most), 4 dB under Harbor Yard's fuel.leak: it's up on a roof
  {
    name: 'water.leak',
    kind: 'loop',
    count: 1,
    duration: 8,
    negative: `${NO}, impact, bang, rain, tap, sink, toilet, bubbling, drips`,
    prompt: foley('Water gushing steadily out of a hole in the side of a wooden rooftop water tank and splashing onto a flat tar roof below: a steady pouring stream and splatter. Continuous and even, no impacts.'),
    play: { near: 4, rolloff: 1, volume: 0.35, voices: 2, reverb: 0.2, pitch: [0.95, 1.05] },
  },
].map(sound);
