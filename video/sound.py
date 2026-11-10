"""Synthesizes the soundtrack (beat + SFX) for promo.html. Output: soundtrack.wav"""
import numpy as np, wave, sys
import re
SR = 44100
_html = open(__file__.rsplit('/', 1)[0] + '/promo.html' if '/' in __file__ else 'promo.html').read()
WARP = eval(re.search(r'const WARP = (\[[\s\S]*?\]\]);', _html).group(1))
IDUR = float(re.search(r'const DUR = ([\d.]+)', _html).group(1))
def O(t):  # internal time -> output time
    o = t
    for a, b, r in WARP:
        if t >= b: o += (b - a) / r - (b - a)
        elif t > a: o += (t - a) / r - (t - a)
    return o
DUR = O(IDUR)
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rs = np.random.default_rng(7)

def bandnoise(n, lo, hi):
    x = rs.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(X, n); return y / (np.abs(y).max() + 1e-9)

def addm(t0, sig, gain=1.0, pan=0.0):
    add(t0, sig, gain, pan, raw=True)

def add(t0, sig, gain=1.0, pan=0.0, raw=False):
    i = int((t0 if raw else O(t0)) * SR)
    if i >= N: return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * (1 - pan) ** .5 * 1.0
    R[i:i + len(sig)] += sig * (1 + pan) ** .5 * 1.0

def env(n, a, d, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * curve / max(d, 1e-4))
    return e

def tone(freqs, dur, a=.002, d=.3, curve=5, kind='sin'):
    n = int(dur * SR); t = np.arange(n) / SR
    f = np.broadcast_to(np.asarray(freqs, float), (n,)) if np.ndim(freqs) == 0 else np.asarray(freqs)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) if kind == 'sin' else (2 * ((ph / (2 * np.pi)) % 1) - 1)
    return s * env(n, a, d, curve)

def kick(g=1.0):
    n = int(.45 * SR); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * g

def hat(g=.2):
    n = int(.06 * SR); return bandnoise(n, 7000, 16000) * env(n, .001, .03, 6) * g

def snare(g=.5):
    n = int(.3 * SR); return (bandnoise(n, 1200, 8000) * .8 + tone(190, .3, d=.08)) * env(n, .001, .12, 5) * g

def whoosh(dur=.5, lo=300, hi=5000, g=.5):
    n = int(dur * SR); x = bandnoise(n, lo, hi)
    t = np.linspace(0, 1, n); e = np.sin(np.pi * t) ** 2
    # crude sweep: amplitude-modulate high band rising
    hb = bandnoise(n, hi * .5, hi * 1.5) * t
    return (x * .7 + hb * .5) * e * g

def boom(g=1.0, f0=40, d=1.6):
    n = int(d * SR); t = np.arange(n) / SR
    f = f0 + 60 * np.exp(-t * 10)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3)
    s += bandnoise(n, 60, 1500) * np.exp(-t * 14) * .5
    return s * g

def click(g=.5):
    n = int(.05 * SR); return bandnoise(n, 1500, 12000) * env(n, .0005, .012, 6) * g

def shutter(g=.6):
    a = click(1); s = np.zeros(int(.12 * SR)); s[:len(a)] += a; s[int(.055 * SR):int(.055 * SR) + len(a)] += a * .7
    return s * g

def chime(freqs, g=.3, d=1.2):
    out = 0
    for i, f in enumerate(freqs): out = out + tone(f, d, d=d * .5, curve=4) * (0.7 ** i)
    return out * g

def blip(f1, f2, g=.35):
    a = tone(f1, .09, d=.06); b = tone(f2, .18, d=.12)
    s = np.zeros(int(.3 * SR)); s[:len(a)] += a; s[int(.08 * SR):int(.08 * SR) + len(b)] += b
    return s * g

# ---------- engine approach 0 -> 1.62 ----------
n = int(1.75 * SR); t = np.arange(n) / SR
rpm = np.where(t < 1.05, 70 + 40 * (t / 1.05), 110 - 60 * np.clip((t - 1.05) / .6, 0, 1))
ph = 2 * np.pi * np.cumsum(rpm) / SR
eng = (np.sin(ph) + .6 * np.sin(2 * ph + 1) + .4 * np.sin(3 * ph) + .25 * np.sign(np.sin(.5 * ph)) ) / 2.2
eng = eng * (1 + .3 * bandnoise(n, 20, 200))
amp = np.clip(t / 1.1, 0, 1) ** 2 * np.where(t < 1.62, 1, np.exp(-(t - 1.62) * 12))
add(0, eng * amp, .55, pan=.5)
add(0.2, whoosh(1.4, 200, 3000, .5), 1, .3)
# tire screech
n = int(.62 * SR); t = np.arange(n) / SR
scr = np.sin(2 * np.pi * np.cumsum(2600 + 300 * np.sin(2 * np.pi * 23 * t)) / SR) * .5 + bandnoise(n, 1800, 4500) * .6
add(1.05, scr * np.minimum(1, t / .05) * np.minimum(1, (0.62 - t) / .1), .28)
add(1.62, boom(1.0), .9)
add(1.62, snare(.4))

# ---------- phonk track (output time) ----------
BPM = 130; BEAT = 60 / BPM; ST = BEAT / 4
DROP = 1.62
def cowbell(f, g=1.0):
    n = int(.22 * SR); t = np.arange(n) / SR
    sq = np.sign(np.sin(2 * np.pi * f * t)) + np.sign(np.sin(2 * np.pi * f * 1.4836 * t))
    X = np.fft.rfft(sq); fr = np.fft.rfftfreq(n, 1 / SR); X[(fr < 450) | (fr > 5000)] = 0
    y = np.fft.irfft(X, n); y /= np.abs(y).max()
    return y * np.exp(-t * 16) * g
def b808(f, dur, g=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    fr = f * (1 + 1.2 * np.exp(-t * 30))
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR)
    y = np.tanh(y * 3) * np.exp(-t * 1.1) * np.minimum(1, (dur - t) / .03)
    return y * g
def clap(g=.5):
    n = int(.25 * SR); x = bandnoise(n, 900, 9000); t = np.arange(n) / SR
    e = sum(np.exp(-np.maximum(0, t - d) * 60) * (t >= d) for d in (0, .01, .022)) / 3 + np.exp(-t * 18) * .6
    return x * e * g
D5, F5, G5, A5, C5, C6 = 587.3, 698.5, 784.0, 880.0, 523.3, 1046.5
MEL = [{0: D5, 3: D5, 6: F5, 8: A5, 10: G5, 12: F5, 14: D5},
       {0: C5, 3: C5, 6: D5, 8: F5, 10: G5, 12: A5, 13: C6, 14: A5}]
BASS = [73.4, 73.4, 58.3, 65.4]
BREAK = (O(42.35), O(43.25))          # drums drop out right before the logo hit
END = DUR - .4
# intro: cowbell riff alone before the car stops
step = DROP - 16 * ST; k = 0
while step < END:
    if step >= 0:
        bar = int(round((step - DROP) / ST)) // 16 if step >= DROP else -1
        pos = int(round((step - DROP) / ST)) % 16
        inbreak = BREAK[0] <= step < BREAK[1]
        mel = MEL[(bar // 1) % 2 if bar >= 0 else 0]
        if pos in mel: addm(step, cowbell(mel[pos]), .16 if step < DROP else .2, pan=.25)
        if step >= DROP and not inbreak:
            if pos in (0, 7, 10): addm(step, kick(1.0))
            if pos in (4, 12): addm(step, clap(.42))
            if pos % 2 == 0: addm(step, hat(.13), pan=-.3)
            if bar % 2 == 1 and pos >= 12: addm(step + ST / 2, hat(.08), pan=.3)
            if pos == 0: addm(step, b808(BASS[bar % 4], BEAT * 3.6), .42)
    step += ST
# riser into the drop and into the logo
n = int(1.4 * SR); tt = np.linspace(0, 1, n)
addm(DROP - 1.4, bandnoise(n, 500, 9000) * tt ** 3, .22)
n = int((BREAK[1] - BREAK[0]) * SR); tt = np.linspace(0, 1, n)
addm(BREAK[0], bandnoise(n, 600, 10000) * tt ** 2.5, .3)
addm(BREAK[0], b808(55, BREAK[1] - BREAK[0]), .25)

# ---------- SFX ----------
for c in [4.65, 7.45, 10.65, 19.25, 25.25, 29.05, 35.05, 37.65]:
    add(c - .32, whoosh(.45, 400, 6000, .45), 1, pan=.2)
add(3.6, boom(.5, 60, .4), .6)             # door
add(4.18, boom(.6, 70, .3), .5)            # foot
add(5.25, chime([2093, 3136, 4186], .18))  # glint
add(7.6, whoosh(1.2, 600, 7000, .35))      # key toss
add(8.95, chime([2637, 3520, 4699, 5274], .22, .6)); add(8.95, click(.6))
for x in (10.78, 11.0, 11.25): add(x, boom(.35, 90, .25), .6); add(x, click(.5))
for f in (12.15, 13.55, 15.0, 16.28): add(f - .02, shutter(.7))
add(16.6, whoosh(.5, 500, 6000, .3))
add(20.0, blip(880, 1320, .25))
for x in (20.6, 21.3, 22.0): add(x, blip(1174, 1568, .3))
add(22.6, blip(1568, 2093, .3))
add(25.4, tone(np.linspace(900, 300, int(.3 * SR)), .3, d=.2), .3)
add(27.6, chime([1046, 1568, 2093], .25, 1.0))
for i in range(10): add(29.5 + i * .12, bandnoise(int(.08 * SR), 2000, 9000) * env(int(.08 * SR), .002, .04), .18, pan=(-.5 + i * .1))
add(31.0, whoosh(.8, 600, 7000, .3)); add(31.8, chime([2637, 3520, 4699], .2, .5))
add(32.32, boom(1.1, 45, 1.2), .9); add(32.32, snare(.5))
# drive-off engine
n = int(2.2 * SR); t = np.arange(n) / SR
rpm = 60 + 120 * np.clip(t / 1.4, 0, 1) ** 1.5
ph = 2 * np.pi * np.cumsum(rpm) / SR
eng = (np.sin(ph) + .6 * np.sin(2 * ph + 1) + .4 * np.sin(3 * ph)) / 2
add(35.5, eng * np.minimum(1, t / .2) * np.exp(-np.maximum(0, t - 1.2) * 2.5), .5, pan=-.5)
add(40.25, chime([523, 784, 1046], .12, 1.5))
add(42.5, whoosh(.75, 400, 7000, .5))
add(43.25, boom(1.3, 36, 2.8), 1.0); add(43.25, chime([523, 784, 1046, 1568, 2093], .2, 2.8)); add(43.25, snare(.5))
for i in range(4): add(43.7 + i * .07, click(.25))
add(45.15, blip(1046, 1568, .25))

mix = np.stack([L, R], 1)
# fade in/out
fi = int(.05 * SR); mix[:fi] *= np.linspace(0, 1, fi)[:, None]
fo = int(.6 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = np.tanh(mix * 1.1) * .9
mix /= max(1e-9, np.abs(mix).max()) / .89
pcm = (mix * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok')
