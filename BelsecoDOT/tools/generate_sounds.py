#!/usr/bin/env python3
"""
Belseco DOT Mega Pack - siren / warning-tone generator.

Synthesises seamless looping placeholder audio for the pack so the siren
controller has something to play out of the box.  Everything is generated from
first principles (no sampled audio), so the files are freely redistributable.

Tones are band-limited sawtooth-ish stacks, which is roughly what a mechanical
speaker driven by a tone generator sounds like once it has been through a horn.

Usage:
    python3 tools/generate_sounds.py
    python3 tools/generate_sounds.py --rate 44100
"""

import argparse
import math
import os
import struct
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "mod", "art", "sound", "belseco")

HARMONICS = 7          # partials in the horn stack
XFADE = 0.006          # seconds of wrap-around crossfade to kill the loop click


def horn(phase, brightness=1.0):
    """Band-limited sawtooth stack - one full 2*pi phase = one cycle."""
    v = 0.0
    for k in range(1, HARMONICS + 1):
        v += math.sin(phase * k) / (k ** (1.0 + (1.0 - brightness)))
    return v / 1.9


def synth(rate, duration, freq_fn, brightness=1.0, amp=0.72):
    n = int(rate * duration)
    phase = 0.0
    out = [0.0] * n
    for i in range(n):
        t = i / rate
        f = freq_fn(t)
        phase += 2.0 * math.pi * f / rate
        out[i] = amp * horn(phase, brightness)
    return out


def wrap_crossfade(samples, rate):
    """Crossfade the tail into the head so the loop point is inaudible."""
    n = int(rate * XFADE)
    if n <= 0 or len(samples) < 2 * n:
        return samples
    head = samples[:n]
    tail = samples[-n:]
    for i in range(n):
        w = i / float(n)
        samples[i] = head[i] * w + tail[i] * (1.0 - w)
    return samples[: len(samples) - n]


def write_wav(name, samples, rate):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name + ".wav")
    frames = bytearray()
    peak = max(1e-6, max(abs(s) for s in samples))
    gain = min(1.0, 0.92 / peak)
    for s in samples:
        v = int(max(-1.0, min(1.0, s * gain)) * 32767)
        frames += struct.pack("<h", v)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(bytes(frames))
    return path


# ---------------------------------------------------------------------------
# Tone definitions - classic North American electronic siren set
# ---------------------------------------------------------------------------
def tone_wail(rate):
    """Slow 4.5 s sweep, 640 -> 1500 -> 640 Hz."""
    period = 4.5

    def f(t):
        x = (t % period) / period
        return 640 + 860 * (0.5 - 0.5 * math.cos(2 * math.pi * x))

    return synth(rate, period, f, brightness=0.95)


def tone_yelp(rate):
    """Fast sweep, ~3.3 sweeps per second."""
    period = 0.30

    def f(t):
        x = (t % period) / period
        return 700 + 800 * (0.5 - 0.5 * math.cos(2 * math.pi * x))

    return synth(rate, period * 8, f, brightness=1.0)


def tone_phaser(rate):
    """Very fast stutter sweep used to punch through at intersections."""
    period = 0.085

    def f(t):
        x = (t % period) / period
        return 880 + 620 * (0.5 - 0.5 * math.cos(2 * math.pi * x))

    return synth(rate, period * 24, f, brightness=1.0)


def tone_hilo(rate):
    """Two-tone hi/lo, 0.55 s per note."""
    note = 0.55

    def f(t):
        return 1080 if int(t / note) % 2 == 0 else 720

    return synth(rate, note * 4, f, brightness=0.85)


def tone_airhorn(rate):
    """Two chimes a minor third apart - the truck air horn."""
    dur = 1.6
    n = int(rate * dur)
    out = [0.0] * n
    p1 = p2 = 0.0
    for i in range(n):
        t = i / rate
        env = min(1.0, t / 0.05) * min(1.0, max(0.0, (dur - t) / 0.12))
        p1 += 2.0 * math.pi * 311.0 / rate
        p2 += 2.0 * math.pi * 415.0 / rate
        out[i] = 0.62 * env * (horn(p1, 0.8) + 0.8 * horn(p2, 0.8))
    return out


def tone_backup(rate):
    """OSHA-style reversing alarm: 0.5 s on, 0.5 s off at 1150 Hz."""
    period = 1.0
    n = int(rate * period * 2)
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / rate
        phase += 2.0 * math.pi * 1150.0 / rate
        on = (t % period) < 0.5
        env = 0.0
        if on:
            local = t % period
            env = min(1.0, local / 0.01) * min(1.0, (0.5 - local) / 0.01)
        out[i] = 0.55 * env * math.sin(phase)
    return out


TONES = {
    "siren_wail": (tone_wail, True),
    "siren_yelp": (tone_yelp, True),
    "siren_phaser": (tone_phaser, True),
    "siren_hilo": (tone_hilo, True),
    "airhorn": (tone_airhorn, False),
    "backup_alarm": (tone_backup, True),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rate", type=int, default=22050)
    args = ap.parse_args()

    for name, (fn, looping) in TONES.items():
        samples = fn(args.rate)
        if looping:
            samples = wrap_crossfade(samples, args.rate)
        path = write_wav(name, samples, args.rate)
        print(
            "wrote %s (%.2fs, %d KiB%s)"
            % (
                os.path.relpath(path, ROOT),
                len(samples) / float(args.rate),
                os.path.getsize(path) // 1024,
                ", seamless loop" if looping else "",
            )
        )


if __name__ == "__main__":
    main()
