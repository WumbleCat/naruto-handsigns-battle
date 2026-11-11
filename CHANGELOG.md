# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
