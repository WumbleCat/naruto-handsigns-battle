"""Hand-sign classifier training for Jutsu Duel.

Pipeline: recordings (raw landmarks, exported by /dev/recorder) -> hands-v1 features (a
byte-for-byte re-implementation of src/detection/features.ts, checked by a golden test) ->
a small MLP trained with PyTorch -> JSON weights evaluated in the browser with no ML runtime.
"""

LABELS = [
    "none",
    "rat",
    "ox",
    "tiger",
    "hare",
    "dragon",
    "snake",
    "horse",
    "ram",
    "monkey",
    "bird",
    "dog",
    "boar",
]

FEATURE_SPEC = "hands-v1"
MODEL_FORMAT = "jutsu-duel-mlp"
RECORDING_FORMAT = "jutsu-duel-recording"
