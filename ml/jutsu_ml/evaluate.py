"""Evaluate an exported model on recordings.

    uv run evaluate --model ../public/models/signs-v1.json --data data/raw/*.json
"""

from __future__ import annotations

import argparse
import glob
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import confusion_matrix

from . import LABELS, MODEL_FORMAT
from .data import load_recordings, to_matrix
from .model import predict_from_json


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Evaluate an exported Jutsu Duel model.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--data", nargs="+", required=True)
    parser.add_argument("--threshold", type=float, default=0.7, help="below this, predict none")
    args = parser.parse_args(argv)

    data = json.loads(Path(args.model).read_text(encoding="utf-8"))
    if data.get("format") != MODEL_FORMAT:
        print(f"{args.model} is not a {MODEL_FORMAT} file", file=sys.stderr)
        return 2
    paths = [Path(p) for pattern in args.data for p in sorted(glob.glob(pattern))]
    samples = load_recordings(paths)
    if not samples:
        print("No samples.", file=sys.stderr)
        return 2
    x, y = to_matrix(samples)
    probabilities = predict_from_json(data, x)
    predicted = probabilities.argmax(axis=1)
    confident = probabilities.max(axis=1) >= args.threshold
    predicted = np.where(confident, predicted, LABELS.index("none"))

    accuracy = float((predicted == y).mean())
    print(f"{len(samples)} samples, accuracy {accuracy:.3f} at threshold {args.threshold}")
    matrix = confusion_matrix(y, predicted, labels=list(range(len(LABELS))))
    width = max(len(label) for label in LABELS)
    print(" " * (width + 1) + " ".join(f"{label[:4]:>4s}" for label in LABELS))
    for i, label in enumerate(LABELS):
        print(f"{label:>{width}s} " + " ".join(f"{int(v):4d}" for v in matrix[i]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
