# Jutsu Duel: training tooling

Python, managed with [uv](https://docs.astral.sh/uv/). Trains the hand-sign classifier from
recordings made in the app's `/dev/recorder` page and exports it as JSON the browser evaluates
with no ML runtime (docs/DESIGN.md 7.4 and 7.7).

```
uv sync                                        # create the venv and install dependencies
uv run pytest                                  # includes the TS/Python feature parity test
uv run train --data data/raw/*.json --out ../public/models/signs-v1.json
uv run evaluate --model ../public/models/signs-v1.json --data data/raw/*.json
uv run references --data data/raw/*.json --out ../src/content/sign-references.json
uv run prune --data data/raw/recording-....json --drop ram
```

## Workflow

1. In the app (`npm run dev`), open `/dev/recorder`, pick a label, capture about 100 samples
   while moving and rotating your hands slightly. Repeat for all twelve signs and for `none`
   (idle hands, transitions, one hand only). Export the session. Record at least two sessions
   on different days or lighting so validation measures a real new session.
2. Drop the exported files into `ml/data/raw/` (git-ignored by default).
3. `uv run train ...` prints validation accuracy and per-class recall and writes the model.
4. Reload the app: webcam mode becomes available once `public/models/signs-v1.json` exists.
5. `uv run references ...` writes `src/content/sign-references.json`: for each sign, the most
   typical frame in the recordings (the medoid in feature space). The app draws these as hand
   skeletons in the Jutsu Book, on the Practice page and on the key map, so players can see
   how to form each sign. Re-run it whenever the recordings change.

## Re-recording one sign

If one sign was recorded badly, drop it from the old file, record it again, and train on both:

```
uv run prune --data data/raw/recording-2026-11-11.json --drop ram
# in the app: /dev/recorder, label Ram, capture, export, move the file into data/raw/
uv run train --data data/raw/*.json --out ../public/models/signs-v1.json
uv run references --data data/raw/*.json --out ../src/content/sign-references.json
```

`prune` rewrites the file in place (pass `--out` to write elsewhere) and keeps its session id.
A session that holds only one sign cannot be held out for validation on its own, so the
trainer falls back to a random split of frames and says so; the accuracy it prints is then
optimistic. Record a second full session when you want an honest number.

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
