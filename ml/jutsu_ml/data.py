"""Loading recordings exported by /dev/recorder and turning them into feature matrices."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from . import LABELS, RECORDING_FORMAT
from .features import extract_features


@dataclass
class Sample:
    label: str
    hands: list[dict[str, Any]]
    session_id: str
    aspect: float


def load_recording(path: Path) -> list[Sample]:
    """One recording file -> samples. Aspect comes from the device block (defaults to 16:9)."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("format") != RECORDING_FORMAT:
        raise ValueError(f"{path} is not a {RECORDING_FORMAT} file")
    device = raw.get("device", {})
    width = float(device.get("videoWidth") or 16)
    height = float(device.get("videoHeight") or 9)
    aspect = width / height if height else 16 / 9
    session_id = str(raw.get("sessionId", path.stem))
    samples: list[Sample] = []
    for sample in raw.get("samples", []):
        label = sample["label"]
        if label not in LABELS:
            raise ValueError(f"{path}: unknown label {label!r}")
        samples.append(Sample(label=label, hands=sample["hands"], session_id=session_id, aspect=aspect))
    return samples


def load_recordings(paths: list[Path]) -> list[Sample]:
    samples: list[Sample] = []
    for path in paths:
        samples.extend(load_recording(path))
    return samples


def to_matrix(samples: list[Sample]) -> tuple[np.ndarray, np.ndarray]:
    """Features (n, 131) float32 and label indices (n,) int64."""
    x = np.stack([extract_features(s.hands, s.aspect) for s in samples]) if samples else np.zeros((0, 131), np.float32)
    y = np.array([LABELS.index(s.label) for s in samples], dtype=np.int64)
    return x, y


def split_by_session(samples: list[Sample], val_fraction: float, seed: int) -> tuple[list[Sample], list[Sample]]:
    """Hold out whole sessions so validation measures a new recording session, not near-duplicate
    frames. With a single session, falls back to a random split (and the caller warns)."""
    rng = np.random.default_rng(seed)
    sessions = sorted({s.session_id for s in samples})
    if len(sessions) < 2:
        indices = rng.permutation(len(samples))
        cut = int(round(len(samples) * (1 - val_fraction)))
        train = [samples[i] for i in indices[:cut]]
        val = [samples[i] for i in indices[cut:]]
        return train, val
    rng.shuffle(sessions)
    held = max(1, int(round(len(sessions) * val_fraction)))
    val_sessions = set(sessions[:held])
    train = [s for s in samples if s.session_id not in val_sessions]
    val = [s for s in samples if s.session_id in val_sessions]
    return train, val
