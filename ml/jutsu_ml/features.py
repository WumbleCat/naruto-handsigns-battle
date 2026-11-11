"""hands-v1 features: a re-implementation of src/detection/features.ts.

The TypeScript extractor is the reference; tests/test_features_parity.py checks this module
against a golden file produced by it. Keep the two in step.
"""

from __future__ import annotations

from typing import Any

import numpy as np

LANDMARKS_PER_HAND = 21
PER_HAND_DIM = LANDMARKS_PER_HAND * 3  # 63
FEATURE_DIM = PER_HAND_DIM * 2 + 3 + 2  # 131

WRIST = 0
MIDDLE_MCP = 9

_OFFSET_LEFT = 0
_OFFSET_RIGHT = PER_HAND_DIM
_OFFSET_INTER = PER_HAND_DIM * 2
_OFFSET_PRESENCE = _OFFSET_INTER + 3


def _usable(hand: dict[str, Any]) -> bool:
    return len(hand.get("landmarks", [])) >= LANDMARKS_PER_HAND


def assign_slots(hands: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Left and right slots: handedness labels win; same label falls back to wrist x order."""
    usable = [hand for hand in hands if _usable(hand)][:2]
    if not usable:
        return None, None
    if len(usable) == 1:
        only = usable[0]
        return (only, None) if only["handedness"] == "Left" else (None, only)
    a, b = usable
    if a["handedness"] != b["handedness"]:
        return (a, b) if a["handedness"] == "Left" else (b, a)
    ax = a["landmarks"][WRIST]["x"]
    bx = b["landmarks"][WRIST]["x"]
    return (a, b) if ax <= bx else (b, a)


def _normalise(hand: dict[str, Any], aspect: float) -> tuple[np.ndarray, np.ndarray, float]:
    points = np.array(
        [[p["x"] * aspect, p["y"], p["z"] * aspect] for p in hand["landmarks"][:LANDMARKS_PER_HAND]],
        dtype=np.float64,
    )
    wrist = points[WRIST]
    scale = max(float(np.linalg.norm(wrist - points[MIDDLE_MCP])), 1e-6)
    return points, wrist, scale


def extract_features(hands: list[dict[str, Any]], aspect: float) -> np.ndarray:
    """131 float32 features, identical to extractFeatures(hands, aspect) in TypeScript.

    `aspect` is videoWidth / videoHeight. Mirrors the float32 arithmetic of the reference by
    computing in float64 and casting once, which matches to well under 1e-6.
    """
    out = np.zeros(FEATURE_DIM, dtype=np.float64)
    left, right = assign_slots(hands)
    left_n = _normalise(left, aspect) if left else None
    right_n = _normalise(right, aspect) if right else None

    for normalised, offset in ((left_n, _OFFSET_LEFT), (right_n, _OFFSET_RIGHT)):
        if normalised is None:
            continue
        points, wrist, scale = normalised
        out[offset : offset + PER_HAND_DIM] = ((points - wrist) / scale).reshape(-1)

    if left_n is not None and right_n is not None:
        _, left_wrist, left_scale = left_n
        _, right_wrist, right_scale = right_n
        mean_scale = (left_scale + right_scale) / 2
        out[_OFFSET_INTER : _OFFSET_INTER + 3] = (right_wrist - left_wrist) / mean_scale

    out[_OFFSET_PRESENCE] = 1.0 if left_n is not None else 0.0
    out[_OFFSET_PRESENCE + 1] = 1.0 if right_n is not None else 0.0
    return out.astype(np.float32)
