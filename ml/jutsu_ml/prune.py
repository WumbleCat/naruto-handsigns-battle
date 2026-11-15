"""Remove labels from a recording so they can be re-recorded.

    uv run prune --data data/raw/recording-....json --drop ram

Rewrites the file in place (or to --out) without the dropped samples. Everything else in the
file, including the session id, is kept, so the pruned file and a new recording of the dropped
sign train together as before.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from . import LABELS, RECORDING_FORMAT


def prune_recording(raw: dict[str, Any], drop: set[str]) -> tuple[dict[str, Any], Counter[str], Counter[str]]:
    """The recording without samples whose label is in `drop`, plus label counts before and after."""
    samples = raw.get("samples", [])
    before = Counter(s["label"] for s in samples)
    kept = [s for s in samples if s["label"] not in drop]
    after = Counter(s["label"] for s in kept)
    return {**raw, "samples": kept}, before, after


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Remove labels from a recording export.")
    parser.add_argument("--data", required=True, help="one recording JSON file")
    parser.add_argument("--drop", nargs="+", required=True, help="labels to remove, e.g. ram")
    parser.add_argument("--out", help="where to write; defaults to rewriting --data in place")
    args = parser.parse_args(argv)

    unknown = [label for label in args.drop if label not in LABELS]
    if unknown:
        print(f"Unknown labels: {', '.join(unknown)}. Known: {', '.join(LABELS)}", file=sys.stderr)
        return 2

    path = Path(args.data)
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("format") != RECORDING_FORMAT:
        print(f"{path} is not a {RECORDING_FORMAT} file", file=sys.stderr)
        return 2

    pruned, before, after = prune_recording(raw, set(args.drop))
    out = Path(args.out) if args.out else path
    out.write_text(json.dumps(pruned, separators=(",", ":")), encoding="utf-8")
    for label in args.drop:
        print(f"removed {before[label]} {label} samples")
    print(f"{sum(after.values())} samples remain in {out} ({out.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
