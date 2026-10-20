#!/usr/bin/env python3
# Neon Alley's raw takes that need work before process-sounds.mjs (run this, then process):
#
# - neon.buzz is made here, not by Stable Audio. In four takes asked three ways (kept in
#   neon.buzz/replaced/), it gave a sub-bass rumble, near silence with a 2.3 kHz whine, and bare
#   crackle, never a sign's buzz. This one is built the way such a buzz comes about: the
#   transformer's core humming at twice the 50 Hz mains, a loose lamination slapping once a cycle
#   and ringing the sheet-metal box, the gas sizzling at each voltage peak, and the odd crackle. 8 s
#   at 100 Hz: process-sounds cuts 0.48 s off each end and crossfades 1.2 s, which leaves 584 whole
#   cycles, so the loop joins in step.
# - alarm.bell: the takes ring for 5 to 7 s of their 10, then die away. Each is cut to whole rings
#   (the period measured from the take's envelope) so that, after process-sounds cuts 0.6 s off
#   each end and crossfades 1.5 s, the loop holds a whole number of rings. The full take is kept as
#   <i>.full.flac.
# - ambience.rain came out 70% between 80 and 320 Hz: under the city's traffic rumble the alley was
#   a low wash. Thinner at the bottom, with a little more patter, it reads as rain.
# - lamp.pop take 0 pops, then the fitting hums on at -41 dB for the rest of its 1.5 s: every lamp
#   shot would hum after it. It's cut to the pop.
#
# The takes it changes are moved aside to <i>.full.flac first (again after a redo), and it can be
# run any number of times.
#
#   python3 -I scripts/assets/packs/neon/prep-sounds.py

import site
import sys

sys.path.insert(0, site.getusersitepackages())  # numpy lives in the user site, which -I leaves out

import json
import os
import subprocess

import numpy as np

RATE = 44100
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../assets-src/packs/neon/sounds')


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(RATE), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)


def write_flac(path, x):
    x = np.ascontiguousarray(x, dtype=np.float32)
    ch = 1 if x.ndim == 1 else x.shape[1]
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', str(ch), '-i', '-', '-c:a', 'flac', '-sample_fmt', 's32', path], input=x.tobytes(), check=True)


def original(name, i):
    """The take as generated, moved aside to <i>.full.flac the first time and after a redo (its .json
    is then newer)."""
    path, full, meta = (f'{ROOT}/{name}/{i}{ext}' for ext in ('.flac', '.full.flac', '.json'))
    if not os.path.exists(full) or os.path.getmtime(meta) > os.path.getmtime(full):
        os.replace(path, full)
        os.utime(full)
    return full


def eq(x, gains):
    """Zero-phase filtering by a gain curve over frequency (circular, which suits a loop)."""
    f = np.fft.rfftfreq(len(x), 1 / RATE)
    g = np.ones_like(f)
    for kind, f0, amount in gains:
        if kind == 'highpass':  # 2nd-order Butterworth magnitude
            g *= 1 / np.sqrt(1 + (f0 / np.maximum(f, 1e-3)) ** 4)
        elif kind == 'lowpass':
            g *= 1 / np.sqrt(1 + (f / f0) ** 4)
        elif kind == 'peak':  # (centre, (dB, width in octaves))
            db, width = amount
            g *= 10 ** (db / 20 * np.exp(-0.5 * (np.log2(np.maximum(f, 1e-3) / f0) / width) ** 2))
    return np.fft.irfft(np.fft.rfft(x) * g, len(x))


# --- The buzz ---


def drift(rng, n, seconds, depth):
    """A slow random wander around 1 (circular, so the loop doesn't jump)."""
    w = eq(rng.standard_normal(n), [('lowpass', 1 / seconds, None)])
    return 1 + depth * w / (np.abs(w).max() + 1e-9)


def crackles(rng, n, rate, level):
    """Clusters of short clicks, a few times a second, at random strengths."""
    out = np.zeros(n)
    t = 0.0
    while True:
        t += rng.exponential(1 / rate)
        if t > n / RATE - 0.05:
            break
        for _ in range(rng.integers(1, 5)):
            at = int((t + rng.uniform(0, 0.03)) * RATE)
            length = int(rng.uniform(0.001, 0.005) * RATE)
            click = rng.standard_normal(length) * np.exp(-np.arange(length) / (length / 4))
            out[at : at + length] += click * level * 10 ** (rng.uniform(-24, 0) / 20)
    return eq(out, [('highpass', 1200, None), ('peak', 3500, (4, 1))])


def unit(x):
    return x / (np.sqrt((x**2).mean()) + 1e-12)


def buzz(seed, hum, rattle, sizzle, gate, crackle_rate, crackle_level):
    """Levels in dB, each part at the same loudness (RMS) to start with. `gate`: how much the sizzle
    pulses with the mains (fully, it putters like a small engine)."""
    rng = np.random.default_rng(seed)
    n = 8 * RATE
    t = np.arange(n) / RATE
    mains = 2 * np.pi * 50 * t
    # The core: 100 Hz and its harmonics, clipped hard enough to buzz
    core = sum(np.sin(2 * k * mains + 0.7 * k * k) / k for k in range(1, 11))
    core = np.tanh(3 * core / np.abs(core).max())
    # A loose lamination: slaps once per 100 Hz cycle when the swing passes a threshold, ringing the box
    swing = np.sin(2 * mains + 0.9)
    slap = np.maximum(swing - 0.55, 0) ** 1.5
    slap = np.diff(slap, prepend=slap[-1])
    slap = eq(slap * drift(rng, n, 0.7, 0.45), [('highpass', 250, None), ('peak', 1750, (12, 0.18)), ('peak', 3100, (8, 0.15)), ('peak', 640, (6, 0.25))])
    # The gas: band noise that flares at each voltage peak
    hiss = eq(rng.standard_normal(n), [('highpass', 2500, None), ('lowpass', 9000, None)])
    hiss *= 1 - gate + gate * np.abs(np.sin(mains)) ** 6
    gain = lambda d: 10 ** (d / 20)
    mix = gain(hum) * unit(core) + gain(rattle) * unit(slap) + gain(sizzle) * unit(hiss)
    mix = mix * drift(rng, n, 0.5, 0.06) + crackles(rng, n, crackle_rate, crackle_level)
    # The sign's box: a couple of resonances, no rumble, softened top
    mix = eq(mix, [('highpass', 140, None), ('peak', 340, (4, 0.35)), ('peak', 1150, (6, 0.3)), ('peak', 2500, (6, 1)), ('lowpass', 11000, None)])
    return (mix / np.abs(mix).max() * 0.7).astype(np.float32)


BUZZ = {
    # A sizzling sign. Mostly core, it was heard as a transformer ("too low and smooth, no sizzle");
    # with a loud sizzle pulsing at 100 Hz, as a lawnmower. So: a steadier sizzle.
    0: dict(seed=11, hum=-2, rattle=-2, sizzle=-6, gate=0.35, crackle_rate=1.4, crackle_level=3),
    # An old one: a loose rattle, more sizzle, crackling more often
    1: dict(seed=23, hum=-2, rattle=0, sizzle=-6, gate=1, crackle_rate=2.2, crackle_level=2.5),
}


def make_buzz():
    os.makedirs(f'{ROOT}/neon.buzz', exist_ok=True)
    for i, p in BUZZ.items():
        write_flac(f'{ROOT}/neon.buzz/{i}.flac', buzz(**p))
        meta_path = f'{ROOT}/neon.buzz/{i}.json'
        meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
        # The fal URL of this very file (uploaded for the QA) stays, a generated take's goes
        keep = {'url': meta['url']} if meta.get('model') == 'synthesized' and 'url' in meta else {}
        json.dump({'model': 'synthesized', 'script': 'scripts/assets/packs/neon/prep-sounds.py', 'duration': 8, **p, **keep}, open(meta_path, 'w'), indent=2)
        print(f'neon.buzz {i}: synthesized')


# --- The alarm bells ---

# take: (start s, length of whole rings in s: the envelope's autocorrelation peak at that many
# rings). Measured on these takes: measure again after a redo.
BELLS = {
    0: (0.10, 3.0704),  # 6 rings of 0.512 s; it rings until 5.4 s
    1: (0.20, 4.1215),  # 4 rings of 1.030 s (ring, pause); it rings until 6.8 s
}
CUT, CROSS = 0.6, 1.5  # what process-sounds does to a 10 s loop


def trim_bells():
    for i, (start, rings) in BELLS.items():
        x = decode(original('alarm.bell', i))
        # The loop that process-sounds makes is (length - 2 cut) - crossfade long: make that whole rings
        a = round(start * RATE)
        length = round(rings * RATE) + round(CROSS * RATE) + 2 * round(CUT * RATE)
        write_flac(f'{ROOT}/alarm.bell/{i}.flac', x[a : a + length])
        print(f'alarm.bell {i}: {start:.2f} to {start + length / RATE:.2f} s of {len(x) / RATE:.1f}')


# --- The rain ---

RAIN = [('highpass', 110, None), ('peak', 190, (-5, 0.8)), ('peak', 3500, (4, 1.2))]


def eq_rain():
    x = decode(original('ambience.rain', 0))
    y = np.stack([eq(x[:, c].astype(np.float64), RAIN) for c in range(2)], axis=1)
    write_flac(f'{ROOT}/ambience.rain/0.flac', y * min(1, 0.95 / np.abs(y).max()))
    print('ambience.rain 0: equalized')


# --- The lamp's pop ---


def cut_pop():
    x = decode(original('lamp.pop', 0))
    # The pop is over by 0.35 s; faded out over its last 0.15
    n, fade = round(0.35 * RATE), round(0.15 * RATE)
    y = x[:n].copy()
    y[n - fade :] *= np.linspace(1, 0, fade)[:, None]
    write_flac(f'{ROOT}/lamp.pop/0.flac', y)
    print('lamp.pop 0: cut to its pop')


make_buzz()
trim_bells()
eq_rain()
cut_pop()
