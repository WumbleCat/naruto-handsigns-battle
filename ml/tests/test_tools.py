"""The helper commands: prune, references, and the session split's fallback."""

import json
from pathlib import Path

import numpy as np

from jutsu_ml import LABELS, RECORDING_FORMAT
from jutsu_ml.data import Sample, load_recording, split_by_session
from jutsu_ml.prune import main as prune_main, prune_recording
from jutsu_ml.references import SIGN_REFERENCES_FORMAT, build_references
from test_train_smoke import synthetic_samples


def test_prune_removes_only_the_dropped_labels(tmp_path: Path) -> None:
    raw = {
        "format": RECORDING_FORMAT,
        "version": 1,
        "sessionId": "s",
        "recordedAt": "2026-11-11T00:00:00Z",
        "featureSpec": "hands-v1",
        "device": {"userAgent": "t", "videoWidth": 640, "videoHeight": 480, "mirror": True},
        "samples": [{"label": label, "t": i, "hands": []} for i, label in enumerate(["ram", "tiger", "ram", "none"])],
    }
    pruned, before, after = prune_recording(raw, {"ram"})
    assert before["ram"] == 2 and after["ram"] == 0
    assert [s["label"] for s in pruned["samples"]] == ["tiger", "none"]
    assert pruned["sessionId"] == "s"

    path = tmp_path / "rec.json"
    path.write_text(json.dumps(raw), encoding="utf-8")
    assert prune_main(["--data", str(path), "--drop", "ram"]) == 0
    assert [s.label for s in load_recording(path)] == ["tiger", "none"]
    assert prune_main(["--data", str(path), "--drop", "cat"]) == 2


def test_split_holds_out_whole_sessions_when_every_session_is_complete() -> None:
    rng = np.random.default_rng(0)
    samples = synthetic_samples(rng, "a", 3) + synthetic_samples(rng, "b", 3)
    train, val, mode = split_by_session(samples, 0.5, seed=0)
    assert mode == "session"
    assert {s.session_id for s in train}.isdisjoint({s.session_id for s in val})
    assert {s.label for s in train} == set(LABELS)


def test_split_falls_back_when_a_session_holds_a_single_sign() -> None:
    rng = np.random.default_rng(0)
    full = [s for s in synthetic_samples(rng, "a", 4) if s.label != "ram"]
    ram_only = [s for s in synthetic_samples(rng, "b", 4) if s.label == "ram"]
    train, val, mode = split_by_session(full + ram_only, 0.2, seed=0)
    assert mode == "random"
    assert len(train) + len(val) == len(full) + len(ram_only)
    assert "ram" in {s.label for s in train}


def test_build_references_picks_one_two_handed_frame_per_sign() -> None:
    rng = np.random.default_rng(0)
    samples = synthetic_samples(rng, "a", 12)
    document = build_references(samples, seed=0)
    assert document["format"] == SIGN_REFERENCES_FORMAT
    references = document["references"]
    assert sorted(references) == sorted(label for label in LABELS if label != "none")
    for reference in references.values():
        assert reference["width"] == 16 and reference["height"] == 9
        assert len(reference["hands"]) == 2
        assert all(len(hand["landmarks"]) == 21 for hand in reference["hands"])
    # The medoid is a real frame from the pool, not an average.
    tiger = references["tiger"]["hands"][0]["landmarks"][5]
    assert any(
        s.label == "tiger"
        and abs(s.hands[0]["landmarks"][5]["x"] - tiger["x"]) < 1e-5
        for s in samples
    )


def test_sample_defaults_keep_old_callers_working() -> None:
    sample = Sample(label="none", hands=[], session_id="s", aspect=16 / 9)
    assert (sample.width, sample.height) == (16.0, 9.0)
