"""Augmentation on raw landmarks (before feature extraction), docs/DESIGN.md 7.7."""

from __future__ import annotations

import copy
import math
from typing import Any

import numpy as np

from .data import Sample


def _rotate_scale_jitter(points: list[dict[str, float]], rng: np.random.Generator, *, jitter: float, scale: float, rotate_deg: float) -> list[dict[str, float]]:
    xs = np.array([p["x"] for p in points])
    ys = np.array([p["y"] for p in points])
    zs = np.array([p["z"] for p in points])
    cx, cy = xs.mean(), ys.mean()
    angle = math.radians(rng.uniform(-rotate_deg, rotate_deg))
    s = rng.uniform(1 - scale, 1 + scale)
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    dx, dy = xs - cx, ys - cy
    rx = cx + s * (dx * cos_a - dy * sin_a)
    ry = cy + s * (dx * sin_a + dy * cos_a)
    rz = zs * s
    noise = rng.normal(0, jitter, size=(len(points), 3))
    return [
        {"x": float(rx[i] + noise[i, 0]), "y": float(ry[i] + noise[i, 1]), "z": float(rz[i] + noise[i, 2])}
        for i in range(len(points))
    ]


def augment_sample(sample: Sample, rng: np.random.Generator, *, jitter: float = 0.004, scale: float = 0.1, rotate_deg: float = 8.0, mirror: bool = False) -> Sample:
    """A perturbed copy: small jitter, uniform scale, in-plane rotation; optional mirror with
    hand slots swapped (for mirror-handed players)."""
    hands: list[dict[str, Any]] = []
    for hand in sample.hands:
        new_hand = copy.deepcopy(hand)
        new_hand["landmarks"] = _rotate_scale_jitter(hand["landmarks"], rng, jitter=jitter, scale=scale, rotate_deg=rotate_deg)
        if mirror:
            new_hand["landmarks"] = [{"x": 1.0 - p["x"], "y": p["y"], "z": p["z"]} for p in new_hand["landmarks"]]
            new_hand["handedness"] = "Right" if hand["handedness"] == "Left" else "Left"
        hands.append(new_hand)
    return Sample(label=sample.label, hands=hands, session_id=sample.session_id, aspect=sample.aspect)


def augment(samples: list[Sample], copies: int, seed: int, *, mirror: bool = False) -> list[Sample]:
    """Original samples plus `copies` augmented variants of each."""
    rng = np.random.default_rng(seed)
    out = list(samples)
    for _ in range(copies):
        for sample in samples:
            out.append(augment_sample(sample, rng, mirror=mirror and bool(rng.integers(0, 2))))
    return out
