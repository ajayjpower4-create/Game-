"""Synthesizes the two looping brake sounds used by the Screeching Brakes mod.

    python3 make_screech_sounds.py <output folder>

Writes car_screech.wav/.ogg and truck_screech.wav/.ogg. Every sound is made
from scratch here, so the mod ships no copyrighted audio.
"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

SR = 44100
LOOP_SECONDS = 4.0
CROSSFADE_SECONDS = 0.5


def smooth_noise(rng, n, rate_hz):
    """Random curve with values roughly in [-1, 1] that changes `rate_hz` times a second."""
    count = int(n / SR * rate_hz) + 4
    pts = rng.standard_normal(count)
    pts /= max(1e-9, np.abs(pts).max())
    pos = np.arange(n) / SR * rate_hz
    i = np.floor(pos).astype(int)
    f = pos - i
    p0, p1, p2, p3 = pts[i], pts[i + 1], pts[i + 2], pts[i + 3]
    return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f ** 2
                  + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3)


def band(x, lo, hi, soft=0.25):
    """Band-pass with soft (log-gaussian) edges, done in the frequency domain."""
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    freqs[0] = 1.0
    lf = np.log2(freqs)
    mask = np.ones_like(lf)
    if lo:
        mask *= 1 / (1 + np.exp(-(lf - np.log2(lo)) / soft))
    if hi:
        mask *= 1 / (1 + np.exp((lf - np.log2(hi)) / soft))
    return np.fft.irfft(spec * mask, len(x))


def tone(rng, freq, harmonics):
    """Sum of harmonics following a time-varying fundamental `freq` (array, Hz)."""
    phase = 2 * np.pi * np.cumsum(freq) / SR
    out = np.zeros_like(freq)
    for h, amp in enumerate(harmonics, start=1):
        out += amp * np.sin(h * phase + rng.uniform(0, 2 * np.pi))
    return out


def make_loop(x):
    """Crossfades the tail into the head so the sound loops without a click."""
    n = int(LOOP_SECONDS * SR)
    c = int(CROSSFADE_SECONDS * SR)
    out = x[:n].copy()
    ramp = np.linspace(0, np.pi / 2, c)
    out[:c] = x[:c] * np.sin(ramp) + x[n:n + c] * np.cos(ramp)
    return out


def finish(x, rms_db):
    x = x - x.mean()
    x *= 10 ** (rms_db / 20) / np.sqrt(np.mean(x ** 2))
    peak = np.abs(x).max()
    if peak > 0.89:
        x *= 0.89 / peak
    return x


def car_screech(rng):
    n = int((LOOP_SECONDS + CROSSFADE_SECONDS) * SR)
    mix = np.zeros(n)
    # Three tires squealing at slightly different pitches give the harsh, dissonant screech.
    for base, amp in ((1040, 1.0), (1385, 0.6), (1730, 0.35)):
        drift = 1 + 0.035 * smooth_noise(rng, n, 1.3) + 0.012 * smooth_noise(rng, n, 6.5)
        jitter = 1 + 0.005 * smooth_noise(rng, n, 70)
        sig = tone(rng, base * drift * jitter, [1.0, 0.62, 0.42, 0.26, 0.16, 0.1, 0.06])
        flutter = 0.72 + 0.28 * smooth_noise(rng, n, 22)
        swell = 0.75 + 0.25 * smooth_noise(rng, n, 0.9)
        mix += amp * sig * flutter * swell
    mix /= np.abs(mix).max()

    white = rng.standard_normal(n)
    hiss = band(white, 1400, 6500)
    hiss *= (0.8 + 0.2 * smooth_noise(rng, n, 15)) / np.abs(hiss).max()
    road = band(white, 40, 260)
    road /= np.abs(road).max()

    sig = mix + 0.32 * hiss + 0.18 * road
    sig = np.tanh(1.8 * sig)
    sig = band(sig, 180, 9000)
    return finish(make_loop(sig), -11)


def truck_screech(rng):
    n = int((LOOP_SECONDS + CROSSFADE_SECONDS) * SR)
    t = np.arange(n) / SR
    # Air-brake drum squeal: a piercing, nearly pure tone that wavers and hops between modes.
    drift = 1 + 0.018 * smooth_noise(rng, n, 0.6) + 0.004 * np.sin(2 * np.pi * 5.3 * t)
    main = tone(rng, 2620 * drift, [1.0, 0.3, 0.1, 0.04])
    hop = 1 / (1 + np.exp(-4 * smooth_noise(rng, n, 0.7)))
    second = tone(rng, 3460 * drift * (1 + 0.006 * smooth_noise(rng, n, 3)), [1.0, 0.2, 0.05])
    squeal = main * (0.55 + 0.45 * (1 - hop)) + 0.8 * second * hop
    chatter = 0.84 + 0.16 * np.sin(2 * np.pi * 11.5 * t + 2 * smooth_noise(rng, n, 1))
    squeal *= chatter * (0.85 + 0.15 * smooth_noise(rng, n, 1.1))
    squeal /= np.abs(squeal).max()

    # Low groan of the big drums underneath the squeal.
    groan_f = 96 * (1 + 0.05 * smooth_noise(rng, n, 1.5))
    groan = tone(rng, groan_f, [1 / h for h in range(1, 24)])
    groan = band(groan, 60, 900)
    groan *= (0.6 + 0.4 * smooth_noise(rng, n, 2.2)) / np.abs(groan).max()

    air = band(rng.standard_normal(n), 3000, 11000)
    air /= np.abs(air).max()

    sig = squeal + 0.3 * groan + 0.07 * air
    sig = np.tanh(1.3 * sig)
    sig = band(sig, 70, 12000)
    return finish(make_loop(sig), -11)


def write_wav(path, x):
    data = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def main():
    out_dir = Path(sys.argv[1])
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, make, seed in (("car_screech", car_screech, 7), ("truck_screech", truck_screech, 11)):
        x = make(np.random.default_rng(seed))
        wav = out_dir / f"{name}.wav"
        write_wav(wav, x)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
                        "-c:a", "libvorbis", "-q:a", "6", str(out_dir / f"{name}.ogg")], check=True)
        print(f"{name}: {len(x) / SR:.2f}s, peak {np.abs(x).max():.2f}")


if __name__ == "__main__":
    main()
