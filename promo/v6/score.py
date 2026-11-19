"""Score for GhostLoop promo v6. Reuses the v5 score (output/soundtrack-v5.wav) for the parts of the film that come
from v5, so its sound design stays frame-synced, and adds new cues for the Higgsfield hero shots with the same synth
helpers as v5 (promo/audio.py). Reads the timeline written by compose.mjs.
Usage: python3 score.py <timeline.json> <out.wav>"""
import json, sys, wave, math
from pathlib import Path
import numpy as np

promo = Path(__file__).resolve().parent.parent
timeline = json.loads(Path(sys.argv[1]).read_text())
seg = {s['id']: s for s in timeline['segments']}

# Load v5's synth helpers (everything above its composition) without running the v5 composition.
src = (promo / 'audio.py').read_text()
H = {}
exec(compile(src.split('# ---- 0–5.6')[0], str(promo / 'audio.py'), 'exec'), H)
RATE = H['RATE']; DUR = timeline['duration'] + 0.4
N = int(RATE * DUR)
H['N'] = N; H['L'] = L = np.zeros(N); H['R'] = R = np.zeros(N)  # synth bus (new cues, v5 helper gain scale)
VL = np.zeros(N); VR = np.zeros(N)  # bus for reused v5 score (already mastered)
pad, pluck, pop, ghost, whoosh, chime, thud, kick, boing, hat, bass = (H[k] for k in 'pad pluck pop ghost whoosh chime thud kick boing hat bass'.split())
D, Fs, A, B, G, E, Cs = H['D'], H['Fs'], H['A'], H['B'], H['G'], H['E'], H['Cs']
BEAT = H['BEAT']

with wave.open(str(promo / 'output' / 'soundtrack-v5.wav')) as w:
    assert w.getframerate() == RATE and w.getnchannels() == 2
    v5 = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2).T.astype(float) / 32767 / .9

def place(at, a, b, gain=1., fade_in=.03, fade_out=.12):
    """Copy v5 score [a, b) to film time `at` with short fades so cuts never click."""
    x = v5[:, int(a * RATE):int(b * RATE)].copy() * gain
    n = x.shape[1]; fi, fo = int(fade_in * RATE), int(fade_out * RATE)
    if fi: x[:, :fi] *= np.linspace(0, 1, fi)
    if fo: x[:, -fo:] *= np.linspace(1, 0, fo)
    i = int(at * RATE); n = min(n, N - i)
    VL[i:i + n] += x[0, :n]; VR[i:i + n] += x[1, :n]

a0 = seg['A']['start']; b0 = seg['build']['start']; s0 = seg['B']['start']; f0 = seg['fix']['start']
c0 = seg['C']['start']; e0 = seg['D']['start']

# ---- A: night desk, the ghost phases out of the laptop. Dark, warm, curious. ----
pad(a0, [D - 24, A - 24, D - 12, 65], 4.4, g=.06, a=1.4)
pluck(a0 + .2, 74, 1.2, .05, -.3, .5); pluck(a0 + 1.0, 77, 1.2, .05, .3, .5)
whoosh(a0 + .25, 1.5, .05, pan=.3)
ghost(a0 + .7, 1.8, 77, .04, -.1); ghost(a0 + 2.3, 1.2, 81, .035, .2)
for k, n in enumerate([81, 86, 89]): pluck(a0 + 1.9 + k * .22, n, .5, .045, pan=(k - 1) * .4, bright=.6)
whoosh(b0 - .7, .8, .06, rise=True)

# ---- build: v5 0–5.6 (drop, upload, app assembles) exactly as in v5 ----
place(b0, seg['build']['from'], seg['build']['from'] + seg['build']['len'], fade_out=.25)

# ---- B: the swarm. v5's night groove, aligned so its landing thud hits as the ghosts dive into the window. ----
dive = s0 + 4.1
whoosh(s0 - .2, .7, .07, rise=True); kick(s0 + .05, .26)
place(dive - (11.92 - 8.5), 8.5, 12.3, fade_in=.05, fade_out=.3)
for k in range(9): pop(s0 + .3 + k * .09, 88 + (k % 4) * 2, .045, pan=math.sin(k * 1.7) * .7)

# ---- fix: v5 12.6–24.5 (stuck, approve, retest) exactly as in v5 ----
place(f0, seg['fix']['from'], seg['fix']['from'] + seg['fix']['len'], fade_in=.08, fade_out=.06)

# ---- hold on "3 → 0": a resolved D-major swell and a riser into the high-five, so the held frame never goes silent ----
fix_end = f0 + seg['fix']['len']
pad(fix_end - .15, [D, Fs, A, D + 12], c0 - fix_end + .5, g=.06, a=.2)
pluck(fix_end, 90, .8, .05, .2, .6)
whoosh(c0 - .55, .6, .06, rise=True)

# ---- C: high-five in the coral ring. ----
kick(c0, .28); chime(c0 + .02, [74, 78, 81, 86], .1, .05)
t, k = c0, 0
while t < e0 + .2:
    kick(t, .2 if k % 2 == 0 else .11); bass(t, D - 24, BEAT * .8, .12); hat(t + BEAT / 2, .028)
    pluck(t, [74, 78, 81, 78][k % 4], BEAT * .4, .055, pan=math.sin(k) * .4, bright=.7)
    t += BEAT; k += 1
pop(c0 + .55, 86, .09); boing(c0 + .6, 72, .08)
for k in range(10): pop(c0 + .7 + k * .06, 84 + (k * 3) % 12, .04, pan=math.sin(k * 1.3) * .8)

# ---- D: hero shot and wordmark. v5's closing chord lands with the "oo". ----
whoosh(e0 - .3, .8, .05, rise=False)
place(e0 + .55, 27.6, 30.0, fade_in=.01, fade_out=.05)
pad(e0 + .55, [D - 12, A - 12, D, Fs, A, D + 12], 5.0, g=.07, a=.6)
for k, n in enumerate([74, 78, 81, 86, 90]): pluck(e0 + 1.35 + k * .1, n, .9, .05, pan=(k - 2) * .25, bright=.6)

# soundtrack-v5.wav was peak-normalized after mixing, so raw helper output is quieter than it. Level the synth bus
# so the new groove under C sits at the RMS of v5's groove under `fix`.
def rms(x, a, b): return float(np.sqrt(np.mean(x[int(a * RATE):int(b * RATE)] ** 2)))
K = rms(VL, f0 + 1, f0 + 10) / max(1e-9, rms(L, c0 + .1, e0))
print(f'synth bus gain {K:.2f}')
mix = np.stack([L * K + VL, R * K + VR])
mix = np.tanh(mix * 1.4) / 1.4
tail = int(1.8 * RATE); mix[:, -tail:] *= np.linspace(1, 0, tail) ** 1.5
mix *= .9 / max(1e-9, np.abs(mix).max())
out = Path(sys.argv[2])
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(RATE); w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype('<i2').tobytes())
print(f'Wrote {out} ({DUR:.2f}s)')
