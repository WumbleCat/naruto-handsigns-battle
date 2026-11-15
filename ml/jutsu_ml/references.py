"""Pick one representative frame per sign and write the app's sign references.

    uv run references --data data/raw/*.json --out ../src/content/sign-references.json

The app draws these as hand skeletons wherever a sign is shown (docs/FRONTEND_DESIGN.md 4.4).
For each sign the medoid frame is chosen: the one closest to all the others in standardised
hands-v1 feature space, so it is a typical pose rather than a lucky or an odd one.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np

from . import LABELS
from .data import Sample, expand_paths, load_recordings
from .features import extract_features

SIGN_REFERENCES_FORMAT = "jutsu-duel-sign-references"
MAX_POOL = 400


def representative(samples: list[Sample], rng: np.random.Generator, max_pool: int = MAX_POOL) -> Sample:
    """The medoid of the samples in standardised feature space. Prefers two-handed frames."""
    two_handed = [s for s in samples if len(s.hands) == 2]
    pool = two_handed if len(two_handed) >= 10 else samples
    if len(pool) > max_pool:
        chosen = sorted(rng.choice(len(pool), size=max_pool, replace=False))
        pool = [pool[i] for i in chosen]
    x = np.stack([extract_features(s.hands, s.aspect) for s in pool]).astype(np.float64)
    x = (x - x.mean(axis=0)) / (x.std(axis=0) + 1e-6)
    squares = (x * x).sum(axis=1)
    distances = np.sqrt(np.maximum(squares[:, None] + squares[None, :] - 2 * x @ x.T, 0))
    return pool[int(np.argmin(distances.sum(axis=1)))]


def _point(p: dict[str, Any]) -> dict[str, float]:
    return {axis: round(float(p[axis]), 5) for axis in ("x", "y", "z")}


def to_reference(sample: Sample) -> dict[str, Any]:
    hands = [
        {
            "handedness": hand["handedness"],
            "score": round(float(hand.get("score", 1.0)), 3),
            "landmarks": [_point(p) for p in hand["landmarks"]],
            "worldLandmarks": [_point(p) for p in hand.get("worldLandmarks", [])],
        }
        for hand in sample.hands
    ]
    return {"width": sample.width, "height": sample.height, "hands": hands}


def build_references(samples: list[Sample], seed: int = 0) -> dict[str, Any]:
    rng = np.random.default_rng(seed)
    references: dict[str, Any] = {}
    for label in LABELS:
        if label == "none":
            continue
        pool = [s for s in samples if s.label == label and s.hands]
        if pool:
            references[label] = to_reference(representative(pool, rng))
    return {"format": SIGN_REFERENCES_FORMAT, "version": 1, "references": references}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write one reference hand pose per sign.")
    parser.add_argument("--data", nargs="+", required=True, help="recording JSON files or globs")
    parser.add_argument("--out", required=True, help="output path (src/content/sign-references.json)")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args(argv)

    paths = expand_paths(args.data)
    if not paths:
        print("No recordings found.", file=sys.stderr)
        return 2
    samples = load_recordings(paths)
    document = build_references(samples, args.seed)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")

    found = document["references"]
    print(f"wrote {len(found)} references to {out} ({out.stat().st_size // 1024} KB)")
    missing = [label for label in LABELS if label != "none" and label not in found]
    if missing:
        print(f"no samples for: {', '.join(missing)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
