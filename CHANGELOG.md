# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Online duel (`/duel`): a server-authoritative 1v1 mode from the owner's specification in
  `docs/handsign-duel/`. Two guests create and join a private room by code, ready up, and fight
  in a 1200 × 700 arena with WASD movement, a stamina-costing dodge with i-frames, HP / chakra /
  stamina regeneration, three jutsu cast by ordered hand signs (Fireball, Lightning Spear, Water
  Shield), real projectiles with swept collision, a 180 s timer, knockout / timeout / forfeit
  results and rematch. Hand signs come from the Q E R T Y U I mock keys or the webcam through the
  trained model. The shared rules live in `packages/duel-shared`, the Colyseus 0.18 room in
  `server`, the client under `src/duel`. Run both with `npm run dev:duel`; `npm run test:e2e`
  plays a whole match in two browsers.
- Sign pad: in keyboard mode the key map on the battle and practice pages is made of buttons.
  Clicking one holds its sign for the full hold time; pressing and holding keeps it down.
  Buttons go through the keyboard detector, so the stabiliser and engine see the same input.
- `KeyboardSignDetector.hold()`, `release()` and `tick()`, plus a `schedule` option so tests
  drive it frame by frame; a test casts a jutsu by clicking its signs through the real
  detector, stabiliser and engine.

- The first trained recognition model ships at `public/models/signs-v1.json` (one recording
  session of the owner's hands, 98.9% validation accuracy), so webcam mode works from a fresh
  clone.
- `npm run model:check`: runs the shipped model over the recordings in `ml/data/raw/` with the
  browser's inference code and prints accuracy per sign; the structural checks on the model
  file run with every `npm test`.
- Hand-sign figures: every sign now shows how to form it as a recorded hand skeleton, drawn
  mirrored to match the camera preview. They appear in the Jutsu Book (sequence steps and the
  sign cards), on the Practice page (a large figure of the sign to make next, a small one per
  step, and a grid of all twelve in free practice) and on the key map of the pre-battle page.
  `src/content/sign-references.json` holds the twelve references extracted from the owner's
  recording.
- `uv run references`: picks the most typical frame per sign from recordings (the medoid in
  feature space) and writes the references file. `uv run prune --drop <sign>` removes a sign
  from a recording so it can be re-recorded.

### Changed

- Keyboard mode no longer asks for the camera on the battle and practice pages; the self
  panel says so and the sign pad takes its place.
- The trainer falls back to a random split, and says so, when the recording sessions do not
  each hold every sign (a re-recording of one sign), instead of holding that sign out of
  training.

### Fixed

- The Vite dev watcher ignores `ml/`, `supabase/` and `.claude/`, which stops EBUSY errors
  while the trainer reads a recording.
- The camera picker in Settings no longer lists the unnamed devices browsers report before
  camera permission is granted, which rendered duplicate entries with empty ids.

## [0.6.0] - 2026-11-11

### Added

- `ml/`: the uv-managed trainer. Loads recorder exports, re-implements the hands-v1 features in
  Python with a golden-file parity test against the TypeScript extractor, splits validation by
  recording session, augments (jitter, scale, rotation, optional mirroring), trains the
  131 → 128 → 64 → 13 MLP with class weights and early stopping, prints per-class recall, and
  exports the browser JSON only after a numpy forward pass agrees with the torch model.
  `uv run train`, `uv run evaluate`, `uv run pytest`.
- Browser inference for the exported model in plain TypeScript (`src/detection/classifier.ts`)
  and a model store that fetches `public/models/signs-v1.json` once and tells a missing file
  from a broken one.
- `MlSignDetector`: landmark frames to features, probabilities, a moving average and a sign,
  through the same stabiliser as the keyboard. Webcam mode now works on the battle and
  practice pages once a model is installed.
- The pre-battle camera check runs the real detector on the preview and asks the player to
  hold the Ram sign before "Start battle" unlocks; without a model it says keyboard mode is
  available, and the battle page bounces to pre-battle if reached without one.
- The recorder shows the live prediction of the installed model.
- `vercel.json`: SPA rewrite, camera allowed for the site's origin, security headers, cache
  headers for hashed assets and the model file. No deployment is made by the config.
- README with setup, the keyboard map, the recorder-to-model workflow, the command list, a map
  of the source tree and screenshots in `docs/screenshots/`.

### Changed

- Faster weaving: a sign registers after a 150 ms hold instead of 250 ms, for the webcam and
  the keyboard alike. The copy that states the hold time now reads it from the balance config.
- `SignFrame` carries the optional class-probability vector from the design doc.
- Practice waits for the model to load before deciding to fall back to the keyboard.

## [0.5.0] - 2026-11-11

### Added

- Settings: appearance, input mode, camera (device picker, test preview, mirror, landmarks,
  detection threshold), key bindings with conflict refusal and reset, audio levels, account
  (username change with availability check, log out). Settings sync with `user_settings`.
- `KeyBindingInput` component.
- Jutsu Book: every jutsu by element with sequence seals, damage from the balance config, what
  it beats and loses to, and a reference card per sign with the recorded hand skeleton when
  `src/content/sign-references.json` has one.
- Practice: free practice and per-jutsu practice with live per-sign feedback, hold ring, miss
  shake, completion stamp, time, best, attempts and completions; a pure, tested tracker.
- Match History: paged table with filters, summary counts, jutsu seals and all empty, loading
  and error states; `countMatches` and cursor paging in the matches API.

## [0.4.0] - 2026-11-11

### Added

- OpponentSource contract, seeded PRNG and the three-difficulty bot: paced weaving, misfires,
  reading the player's opener to counter, Substitution reactions, hard-bot clash timing.
- BattleController wiring engine, detector, stabiliser, opponent and a pause-aware clock, with
  tests against a fake detector and a scripted opponent.
- Pre-battle page: difficulty, input mode, camera check with typed error states, key map.
- Battle stage: HP bars with damage ghost, timer, flight strip with clash bursts and dodge
  marks, video panels, Substitution cooldown seal, sign trails with candidate name, countdown,
  pause and forfeit, result word, live-region announcements.
- Results page with stats and jutsu used, rematch, change difficulty and back to menu.
- Match persistence to Supabase with a localStorage retry queue flushed on sign-in.
- Dev-only local sign-in when Supabase is not configured, so the game can be played offline.

## [0.3.0] - 2026-11-11

### Added

- Camera service (`src/detection/camera.ts`) with device listing, constraint fallback and typed
  errors for permission denied, no camera, camera in use and unplugged.
- MediaPipe Hand Landmarker wrapper loaded on demand (GPU with CPU fallback), a landmark
  overlay, and the `hands-v1` feature extractor (131 features, wrist-relative and
  scale-invariant, consistent hand slots, presence flags) with invariance tests.
- Keyboard sign detector: twelve rebindable keys through the same stabiliser as the webcam.
- `VideoPanel` and `DetectionReadout` components.
- Dev-only `/dev/recorder`: live preview with overlay, label picker, countdown, capture of N
  samples, undo, clear, import and export of `jutsu-duel-recording` JSON, and sign references
  export for the Jutsu Book.

## [0.2.0] - 2026-11-11

### Added

- The demo roster: eleven jutsus with sequences, themed names and flavour text, with tests for
  the roster invariants (prefix-free, one opener per element, no repeated signs).
- The complete balance config: damage table, clash multipliers, Substitution cooldown and whiff
  rule, round timer, input timings and the bot parameter table.
- The battle engine (`src/engine`): deterministic, timestamp-driven, pure TypeScript. Buffer
  rules, automatic casting, flight, instant clash resolution, Substitution, KO, double-KO draw,
  round timer, forfeit, per-player stats, typed events and immutable snapshots.
- Sequence matcher with roster validation, element cycle helpers, and the sign stabiliser
  (hold time and release rule). 105 tests in total.

## [0.1.0] - 2026-11-11

### Added

- Tooling: Vite 8, React 19, TypeScript 5.9 (strict), ESLint 10 with type-aware rules and an
  engine purity rule, Prettier, Vitest 5. `npm run check` is the merge gate.
- Design system: tokens for dark and light themes, self-hosted Yuji Syuku and Zen Kaku Gothic
  New, and the primitives (Button, LinkButton, Seal with eighteen original glyphs, text and
  password fields, Toggle, Select, Slider, SegmentedControl, Banner, Dialog, Toast, empty and
  error states, PageShell, Spinner, Skeleton, desktop-only notice).
- Content config holding every themed string, and the start of the balance config.
- Settings store validated with zod and cached in localStorage; theme (system, dark, light)
  applied before first paint and switchable in Settings.
- Routing: every v1 route, public and app layouts, auth guards with return paths, desktop-only
  rules, dev-only `/dev/styleguide` and `/dev/recorder` routes.
- Pages built to the design doc: Landing (sign wheel, how a duel works, element cycle), Home
  (brush index with preview panel), Login, Signup, Settings (theme), 404. Stubs for the rest.
- Supabase: migrations for `profiles`, `matches` and `user_settings` with Row Level Security,
  the profile trigger and the username availability function; typed client; AuthProvider with
  session restore, sign up, log in, log out and error mapping.
- Phase 0 design documents (`docs/DESIGN.md`, `docs/FRONTEND_DESIGN.md`), `CLAUDE.md`,
  `docs/PROGRESS.md` with the `update-progress` skill and a Stop hook that keeps it current.
