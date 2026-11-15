"""End to end on synthetic data: train a few epochs, export, and predict from the JSON."""

import json
from pathlib import Path

import numpy as np

from jutsu_ml import LABELS, MODEL_FORMAT
from jutsu_ml.data import Sample, load_recording, split_by_session, to_matrix
from jutsu_ml.model import predict_from_json
from jutsu_ml.train import train_model


def pose_offsets(label_index: int, hand_index: int) -> np.ndarray:
    """A fixed, distinctive finger layout per label and hand (seeded by the label)."""
    rng = np.random.default_rng(1000 + label_index * 10 + hand_index)
    return rng.normal(0, 0.03, size=(21, 3))


def synthetic_hand(rng: np.random.Generator, handedness: str, cx: float, cy: float, spread: float, offsets: np.ndarray) -> dict:
    landmarks = []
    for i in range(21):
        angle = i / 21 * np.pi
        reach = (0.0 if i == 0 else 0.5 + (i % 4) / 4) * spread
        x = cx + np.cos(angle) * reach + offsets[i, 0] * spread * 5 + rng.normal(0, 0.003)
        y = cy - np.sin(angle) * reach + offsets[i, 1] * spread * 5 + rng.normal(0, 0.003)
        z = offsets[i, 2] * spread + rng.normal(0, 0.002)
        landmarks.append({"x": float(x), "y": float(y), "z": float(z)})
    landmarks[0] = {"x": cx, "y": cy, "z": 0.0}
    landmarks[9] = {"x": cx, "y": cy - spread, "z": 0.0}
    return {"handedness": handedness, "score": 0.95, "landmarks": landmarks, "worldLandmarks": landmarks}


def synthetic_samples(rng: np.random.Generator, session: str, per_label: int) -> list[Sample]:
    """Each label gets its own distinctive geometry so a tiny model can separate them."""
    samples: list[Sample] = []
    for index, label in enumerate(LABELS):
        for _ in range(per_label):
            spread = rng.uniform(0.08, 0.14)  # distance from the camera varies
            if label == "none":
                hands = [] if rng.random() < 0.5 else [synthetic_hand(rng, "Left", 0.3, 0.5, spread, pose_offsets(0, 0))]
            else:
                gap = (1.2 + (index % 4) * 0.4) * spread
                hands = [
                    synthetic_hand(rng, "Left", 0.4, 0.5, spread, pose_offsets(index, 0)),
                    synthetic_hand(rng, "Right", 0.4 + gap, 0.5, spread, pose_offsets(index, 1)),
                ]
            samples.append(Sample(label=label, hands=hands, session_id=session, aspect=16 / 9))
    return samples


def test_train_export_and_predict(tmp_path: Path) -> None:
    rng = np.random.default_rng(0)
    samples = synthetic_samples(rng, "a", 12) + synthetic_samples(rng, "b", 12)
    train, val, mode = split_by_session(samples, 0.5, seed=0)
    assert mode == "session"
    assert {s.session_id for s in train} != {s.session_id for s in val}

    exported, metrics = train_model(
        train,
        val,
        epochs=40,
        hidden=(32, 16),
        learning_rate=5e-3,
        batch_size=32,
        seed=0,
        augment_copies=1,
        mirror=False,
        patience=40,
        log=lambda *_: None,
    )
    assert exported["format"] == MODEL_FORMAT
    assert exported["inputDim"] == 131
    assert exported["labels"] == LABELS
    assert [layer["activation"] for layer in exported["layers"]] == ["relu", "relu", "softmax"]
    assert metrics["valAccuracy"] > 0.8
    assert metrics["exportAgreement"] == 1.0

    # Round trip through disk and the numpy forward pass.
    path = tmp_path / "model.json"
    path.write_text(json.dumps(exported), encoding="utf-8")
    loaded = json.loads(path.read_text(encoding="utf-8"))
    x, y = to_matrix(val)
    probabilities = predict_from_json(loaded, x)
    assert probabilities.shape == (len(val), len(LABELS))
    np.testing.assert_allclose(probabilities.sum(axis=1), 1.0, atol=1e-5)
    assert (probabilities.argmax(axis=1) == y).mean() > 0.8


def test_load_recording_rejects_other_formats(tmp_path: Path) -> None:
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"format": "other"}), encoding="utf-8")
    try:
        load_recording(bad)
    except ValueError as error:
        assert "jutsu-duel-recording" in str(error)
    else:
        raise AssertionError("expected a ValueError")
