// The cars' insides (PACK=cars): what scripts/assets/process-cars.py lines their cabins, engine bays
// and trunks with. The surfaces are GPT Image 2.5's, made to tile by process-textures.py (this pack's
// textures.py); the quilted leather and the carbon weave are drawn there instead (a pattern the image
// model can't make repeat exactly). The instrument faces and the screen are pictures, not tiles.

import { tex } from '../../textures.mjs';

/** A picture of a display, lit as at dusk: no tiling, no text but numerals. */
const display = (s) => `${s} Seen straight on, filling the whole frame edge to edge, flat, no reflections, no glare, no bezel, no hands, no car interior around it. No brand names, no logos, no words.`;

export const textures = [
  {
    name: 'car_leather_black',
    prompt: tex('Texture of black automotive nappa leather upholstery seen straight on: a fine, even natural grain, a soft satin sheen, faintly creased. No seams, no stitching. The frame shows a 30 cm × 30 cm patch.'),
  },
  {
    name: 'car_leather_tan',
    prompt: tex('Texture of cognac tan automotive leather upholstery seen straight on: warm brown with a fine, even natural grain and slight colour variation, faintly creased. No seams, no stitching. The frame shows a 30 cm × 30 cm patch.'),
  },
  {
    name: 'car_fabric',
    prompt: tex('Texture of dark charcoal grey woven car seat fabric seen straight on: a tight, fine woven pattern of mixed dark and mid grey threads, slightly fuzzy, matte. The frame shows a 20 cm × 20 cm patch.'),
  },
  {
    name: 'car_carpet',
    prompt: tex('Texture of anthracite automotive floor carpet seen straight on: dense short cut-pile tufted carpet, near black with fine grey flecks, even, slightly worn and dusty. The frame shows a 30 cm × 30 cm patch.'),
  },
  {
    name: 'car_plastic',
    prompt: tex('Texture of a dark grey soft-touch car dashboard surface seen straight on: matte moulded plastic with a fine, even pebbled leather-like grain. Uniform colour. The frame shows a 20 cm × 20 cm patch.'),
  },
  {
    name: 'car_headliner',
    prompt: tex('Texture of a light grey car headliner fabric seen straight on: soft, fine, matte brushed felt with a faint fibrous texture, very even pale warm grey. The frame shows a 30 cm × 30 cm patch.'),
  },
  {
    name: 'car_plywood',
    prompt: tex('Texture of a delivery van cargo floor seen straight on: worn birch plywood lining with fine wood grain, scuffs, scratches and grime from boxes dragged over it, a few dark stains. The frame shows a 1 m × 1 m patch.'),
  },
  {
    name: 'car_gauges',
    size: { width: 1536, height: 640 },
    prompt: display(
      "A car's lit instrument cluster face at night: two large round analogue dials side by side, a speedometer on the left numbered 0 to 260 and a tachometer on the right numbered 0 to 8 " +
        'with a red zone at the top, thin glowing white numerals and tick marks on a deep black face, slim bright orange-red needles, between the dials a small dark rectangular display with a few glowing icons.',
    ),
  },
  {
    name: 'car_screen',
    size: { width: 1536, height: 1024 },
    prompt: display("A car's centre touchscreen at night showing a navigation map in dark mode: a dark grey city street grid, a glowing blue route along several streets, a small white arrow for the car, a few soft icons along the left edge."),
  },
];
