"""Synthesizes the soundtrack (beat + SFX) for promo.html. Output: soundtrack.wav"""
import numpy as np, wave, sys
SR = 44100; DUR = 44.5
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rs = np.random.default_rng(7)

def bandnoise(n, lo, hi):
    x = rs.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(X, n); return y / (np.abs(y).max() + 1e-9)

def add(t0, sig, gain=1.0, pan=0.0):
    i = int(t0 * SR)
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

# ---------- beat 1.62 -> 44 ----------
bpm = 100; beat = 60 / bpm
bt = 1.62
while bt < 43.6:
    i = round((bt - 1.62) / beat)
    quiet = 39.2 < bt < 40.25
    if not quiet:
        if i % 4 in (0, 2) or (i % 8 == 7): add(bt, kick(.85))
        if i % 4 == 1 or i % 4 == 3: add(bt, snare(.28))
        add(bt, hat(.12), pan=-.3); add(bt + beat / 2, hat(.08), pan=.3)
    bt += beat
# sub bass line
notes = [41.2, 41.2, 36.7, 49.0]
bt = 1.62; k = 0
while bt < 43.6:
    if not (39.2 < bt < 40.25):
        f = notes[(k // 4) % 4]
        add(bt, tone(f, beat * 2, a=.01, d=beat * 1.6, curve=2.5), .35)
        add(bt, tone(f * 2, beat * 2, a=.01, d=beat, curve=3, kind='saw'), .04)
    bt += beat * 2; k += 2
# pad
n = int(42 * SR); t = np.arange(n) / SR
pad = sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate([110, 164.8, 220.5, 261.6])) / 4
pad *= np.clip(t / 3, 0, 1) * (.6 + .4 * np.sin(2 * np.pi * .1 * t))
add(1.62, pad, .05)

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
# riser + final hit
n = int(1.0 * SR); t = np.linspace(0, 1, n)
add(39.25, bandnoise(n, 800, 9000) * t ** 3, .35)
add(40.25, boom(1.2, 38, 2.5), .9); add(40.25, chime([523, 784, 1046, 1568], .18, 2.5))
add(41.8, blip(1046, 1568, .25))

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
