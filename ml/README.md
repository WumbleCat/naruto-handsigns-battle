# Jutsu Duel: training tooling

Python, managed with [uv](https://docs.astral.sh/uv/). Trains the hand-sign classifier from
recordings made in the app's `/dev/recorder` page and exports it as JSON the browser evaluates
with no ML runtime (docs/DESIGN.md 7.4 and 7.7).

```
uv sync                                        # create the venv and install dependencies
uv run pytest                                  # includes the TS/Python feature parity test
uv run train --data data/raw/*.json --out ../public/models/signs-v1.json
uv run evaluate --model ../public/models/signs-v1.json --data data/raw/*.json
```

## Workflow

1. In the app (`npm run dev`), open `/dev/recorder`, pick a label, capture about 100 samples
   while moving and rotating your hands slightly. Repeat for all twelve signs and for `none`
   (idle hands, transitions, one hand only). Export the session. Record at least two sessions
   on different days or lighting so validation measures a real new session.
2. Drop the exported files into `ml/data/raw/` (git-ignored by default).
3. `uv run train ...` prints validation accuracy and per-class recall and writes the model.
4. Reload the app: webcam mode becomes available once `public/models/signs-v1.json` exists.

## Options

`--epochs 60 --hidden 128 64 --learning-rate 1e-3 --batch-size 64 --val-fraction 0.2
--augment-copies 3 --patience 10 --seed 1 --mirror`. `--mirror` adds mirrored copies with the
hand slots swapped for mirror-handed players.

## Features

`jutsu_ml/features.py` re-implements `src/detection/features.ts` (spec `hands-v1`, 131
floats). `tests/test_features_parity.py` compares it against
`tests/fixtures/features-golden.json`, which the TypeScript test
`src/detection/features.golden.test.ts` generates. If you change the feature spec, change both,
run `UPDATE_GOLDEN=1 npm test -- features.golden` to regenerate the fixture, then
`uv run pytest`.
