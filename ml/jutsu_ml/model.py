"""The MLP and its JSON export (docs/DESIGN.md 7.4)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn

from . import FEATURE_SPEC, LABELS, MODEL_FORMAT
from .features import FEATURE_DIM


class SignMlp(nn.Module):
    def __init__(self, hidden: tuple[int, ...] = (128, 64), dropout: float = 0.2) -> None:
        super().__init__()
        layers: list[nn.Module] = []
        width = FEATURE_DIM
        for size in hidden:
            layers.append(nn.Linear(width, size))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(dropout))
            width = size
        layers.append(nn.Linear(width, len(LABELS)))
        self.net = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:  # noqa: D102
        return self.net(x)


def export_model(
    model: SignMlp,
    mean: np.ndarray,
    std: np.ndarray,
    *,
    metrics: dict[str, Any],
    training: dict[str, Any],
    decimals: int = 5,
) -> dict[str, Any]:
    """The browser format: dense layers with explicit activations, weights rounded for size."""
    layers: list[dict[str, Any]] = []
    linear = [m for m in model.net if isinstance(m, nn.Linear)]
    for index, layer in enumerate(linear):
        weights = np.round(layer.weight.detach().cpu().numpy().astype(np.float64), decimals)
        bias = np.round(layer.bias.detach().cpu().numpy().astype(np.float64), decimals)
        layers.append(
            {
                "type": "dense",
                "weights": weights.tolist(),
                "bias": bias.tolist(),
                "activation": "softmax" if index == len(linear) - 1 else "relu",
            }
        )
    return {
        "format": MODEL_FORMAT,
        "version": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "featureSpec": FEATURE_SPEC,
        "inputDim": FEATURE_DIM,
        "labels": list(LABELS),
        "standardisation": {
            "mean": np.round(mean.astype(np.float64), decimals).tolist(),
            "std": np.round(std.astype(np.float64), decimals).tolist(),
        },
        "layers": layers,
        "metrics": metrics,
        "training": training,
    }


def save_model_json(data: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")


def predict_from_json(data: dict[str, Any], features: np.ndarray) -> np.ndarray:
    """Pure-numpy forward pass over the exported JSON, mirroring src/detection/classifier.ts.
    Used by evaluate and the smoke test to prove the export round-trips."""
    mean = np.array(data["standardisation"]["mean"], dtype=np.float32)
    std = np.array(data["standardisation"]["std"], dtype=np.float32)
    x = (features.astype(np.float32) - mean) / np.where(std == 0, 1, std)
    for layer in data["layers"]:
        w = np.array(layer["weights"], dtype=np.float32)
        b = np.array(layer["bias"], dtype=np.float32)
        x = x @ w.T + b
        if layer["activation"] == "relu":
            x = np.maximum(x, 0)
        elif layer["activation"] == "softmax":
            x = x - x.max(axis=-1, keepdims=True)
            e = np.exp(x)
            x = e / e.sum(axis=-1, keepdims=True)
    return x
