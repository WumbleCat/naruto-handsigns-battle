"""Train the sign classifier and export it for the browser.

    uv run train --data data/raw/*.json --out ../public/models/signs-v1.json
"""

from __future__ import annotations

import argparse
import glob
import sys
from pathlib import Path
from typing import Any

import numpy as np
import torch
from sklearn.metrics import confusion_matrix, recall_score
from torch import nn

from . import LABELS
from .augment import augment
from .data import Sample, load_recordings, split_by_session, to_matrix
from .model import SignMlp, export_model, predict_from_json, save_model_json


def _expand(patterns: list[str]) -> list[Path]:
    paths: list[Path] = []
    for pattern in patterns:
        matches = sorted(glob.glob(pattern))
        paths.extend(Path(m) for m in matches)
        if not matches and Path(pattern).exists():
            paths.append(Path(pattern))
    return paths


def train_model(
    train_samples: list[Sample],
    val_samples: list[Sample],
    *,
    epochs: int,
    hidden: tuple[int, ...],
    learning_rate: float,
    batch_size: int,
    seed: int,
    augment_copies: int,
    mirror: bool,
    patience: int,
    log: Any = print,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Returns (exported model json, metrics)."""
    torch.manual_seed(seed)
    np.random.seed(seed)

    augmented = augment(train_samples, augment_copies, seed, mirror=mirror)
    x_train, y_train = to_matrix(augmented)
    x_val, y_val = to_matrix(val_samples)

    mean = x_train.mean(axis=0)
    std = x_train.std(axis=0)
    std[std == 0] = 1.0
    xt = torch.from_numpy((x_train - mean) / std)
    yt = torch.from_numpy(y_train)
    xv = torch.from_numpy((x_val - mean) / std) if len(x_val) else None
    yv = torch.from_numpy(y_val) if len(y_val) else None

    counts = np.bincount(y_train, minlength=len(LABELS)).astype(np.float64)
    weights = np.where(counts > 0, counts.sum() / (len(LABELS) * np.maximum(counts, 1)), 0.0)
    criterion = nn.CrossEntropyLoss(weight=torch.tensor(weights, dtype=torch.float32))

    model = SignMlp(hidden=hidden)
    optimiser = torch.optim.Adam(model.parameters(), lr=learning_rate, weight_decay=1e-4)

    best_state = {k: v.clone() for k, v in model.state_dict().items()}
    best_val = float("inf")
    stale = 0
    epochs_run = 0

    for epoch in range(1, epochs + 1):
        model.train()
        permutation = torch.randperm(len(xt))
        total = 0.0
        for start in range(0, len(xt), batch_size):
            idx = permutation[start : start + batch_size]
            optimiser.zero_grad()
            loss = criterion(model(xt[idx]), yt[idx])
            loss.backward()
            optimiser.step()
            total += loss.item() * len(idx)
        train_loss = total / max(len(xt), 1)
        epochs_run = epoch

        if xv is not None and yv is not None:
            model.eval()
            with torch.no_grad():
                logits = model(xv)
                val_loss = float(criterion(logits, yv))
                val_acc = float((logits.argmax(dim=1) == yv).float().mean())
            log(f"epoch {epoch:3d}  train loss {train_loss:.4f}  val loss {val_loss:.4f}  val acc {val_acc:.3f}")
            if val_loss < best_val - 1e-4:
                best_val = val_loss
                best_state = {k: v.clone() for k, v in model.state_dict().items()}
                stale = 0
            else:
                stale += 1
                if stale >= patience:
                    log(f"early stop after {epoch} epochs")
                    break
        else:
            log(f"epoch {epoch:3d}  train loss {train_loss:.4f}")
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state)
    model.eval()

    metrics: dict[str, Any] = {"valAccuracy": None, "perClassRecall": {}, "confusion": []}
    if len(x_val):
        with torch.no_grad():
            predicted = model(torch.from_numpy((x_val - mean) / std)).argmax(dim=1).numpy()
        metrics["valAccuracy"] = float((predicted == y_val).mean())
        recalls = recall_score(y_val, predicted, labels=list(range(len(LABELS))), average=None, zero_division=0)
        metrics["perClassRecall"] = {LABELS[i]: float(r) for i, r in enumerate(recalls)}
        metrics["confusion"] = confusion_matrix(y_val, predicted, labels=list(range(len(LABELS)))).tolist()

    training = {
        "samples": len(train_samples),
        "augmentedSamples": len(augmented),
        "validationSamples": len(val_samples),
        "sessions": len({s.session_id for s in train_samples + val_samples}),
        "epochs": epochs_run,
        "hidden": list(hidden),
        "augmentation": ["jitter", "scale", "rotate"] + (["mirror"] if mirror else []),
        "seed": seed,
    }
    exported = export_model(model, mean, std, metrics=metrics, training=training)

    # Prove the export round-trips: the JSON forward pass must agree with the torch model.
    if len(x_val):
        from_json = predict_from_json(exported, x_val).argmax(axis=1)
        agreement = float((from_json == predicted).mean())
        metrics["exportAgreement"] = agreement
        exported["metrics"] = metrics
    return exported, metrics


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Train the Jutsu Duel sign classifier.")
    parser.add_argument("--data", nargs="+", required=True, help="recording JSON files or globs")
    parser.add_argument("--out", required=True, help="output model JSON path")
    parser.add_argument("--epochs", type=int, default=60)
    parser.add_argument("--hidden", type=int, nargs="+", default=[128, 64])
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--val-fraction", type=float, default=0.2)
    parser.add_argument("--augment-copies", type=int, default=3)
    parser.add_argument("--mirror", action="store_true", help="also mirror hands (for mirror-handed players)")
    parser.add_argument("--patience", type=int, default=10)
    parser.add_argument("--seed", type=int, default=1)
    args = parser.parse_args(argv)

    paths = _expand(args.data)
    if not paths:
        print("No recordings found.", file=sys.stderr)
        return 2
    samples = load_recordings(paths)
    if not samples:
        print("Recordings contain no samples.", file=sys.stderr)
        return 2
    sessions = {s.session_id for s in samples}
    if len(sessions) < 2:
        print("Warning: only one recording session; validation uses a random split and will be optimistic.")
    train_samples, val_samples = split_by_session(samples, args.val_fraction, args.seed)
    print(f"{len(samples)} samples from {len(paths)} files, {len(sessions)} sessions; train {len(train_samples)}, val {len(val_samples)}")

    exported, metrics = train_model(
        train_samples,
        val_samples,
        epochs=args.epochs,
        hidden=tuple(args.hidden),
        learning_rate=args.learning_rate,
        batch_size=args.batch_size,
        seed=args.seed,
        augment_copies=args.augment_copies,
        mirror=args.mirror,
        patience=args.patience,
    )
    out = Path(args.out)
    save_model_json(exported, out)
    print(f"validation accuracy: {metrics['valAccuracy']}")
    for label, recall in metrics["perClassRecall"].items():
        print(f"  recall {label:8s} {recall:.3f}")
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
