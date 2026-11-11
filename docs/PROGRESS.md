# Progress and roadmap

Last updated: 2026-11-11. Branch: `feat/sign-pad`.

This is the living status page for Jutsu Duel. It answers three questions: where the project
is, what changed recently, and what comes next. Release notes by version live in
`CHANGELOG.md`; design detail lives in `docs/DESIGN.md` and `docs/FRONTEND_DESIGN.md`. The
`update-progress` skill keeps this file current after every commit (see the last section).

## Where we are

Phase 0 is approved. On 2026-11-11 the owner confirmed the element tell, the 120 s round timer,
the Substitution whiff cooldown, instant clash resolution and the whole visual direction, and
asked for a light theme in addition to the dark one. The decisions are recorded in
`docs/DESIGN.md` section 13 and `docs/FRONTEND_DESIGN.md` sections 3 and 10; everything not
explicitly decided proceeds with the defaults in `docs/DESIGN.md` section 14.

Milestone v0.1.0 is complete and tagged: tooling, the design system in both themes, every v1
route with the public pages built to the design doc, and Supabase accounts (sign up with a
unique username, log in, log out, protected routes) behind three migrations with RLS.
`npm run check` is green with 38 tests. Auth has been verified against a mocked client only;
the owner still needs a Supabase project and `.env.local` to try it live.

Milestone v0.2.0 is complete and tagged: the roster, jutsu names and full balance config, plus
the deterministic battle engine (buffer rules, flight, instant clash, Substitution and its
cooldown, KO, round timer, forfeit), the sequence matcher with roster validation, and the
stabiliser, all pure TypeScript checked without the DOM lib. 105 tests pass.

Milestone v0.3.0 is complete and tagged: camera service with typed errors, MediaPipe hand
tracking loaded on demand with a landmark overlay, the 131-feature extractor, the keyboard
detector, and the `/dev/recorder` page that captures labelled landmark samples and exports
them. The recorder was driven end to end in headless Chrome with a fake camera: tracking
reached "ready" and a capture completed with no console errors. 137 tests pass.

Milestone v0.4.0 is complete and tagged: the game is playable against the bot with the
keyboard, start to finish. Bot with three difficulties, battle controller, pre-battle page,
the full battle stage, the results page, and match persistence with a retry queue. A keyboard
match against the hard bot was driven end to end in headless Chrome with no console errors.
171 tests pass. Webcam play waits on the recognition model (v0.6.0); live saving waits on the
owner's Supabase project.

Milestone v0.5.0 is complete and tagged: every v1 page exists and is built to the design doc.
Settings (synced to Supabase), the Jutsu Book, Practice and Match History joined the playable
battle. 188 tests pass. Webcam play still waits on the recognition model.

Milestone v0.6.0 is complete and tagged: the v1 demo is feature-complete. The uv-managed
trainer in `ml/` turns recorder exports into the browser model; the webcam detector evaluates
it in plain TypeScript through the same stabiliser as the keyboard; the pre-battle check proves
camera, tracking, model and hold rule with one held sign; the Vercel config and the README with
screenshots are in. 198 tests pass and `uv run pytest` passes. The webcam pipeline was
smoke-tested in headless Chrome with a model trained on synthetic poses, with and without the
file present, with no console errors.

What the demo still needs from the owner: a Supabase project (`.env.local`) to try accounts,
settings sync and match history live, and recorded hand-sign sessions from `/dev/recorder` to
train a real model (then `uv run train`, commit `public/models/signs-v1.json`). Deployment to
Vercel is configured but not performed.

After the tag, the owner asked for a way to test without a camera: keyboard mode now leaves the
camera off and the key map is a clickable sign pad, with a test that casts a jutsu by clicking
its signs (`feat/sign-pad`, unreleased).

Next action: the owner's review of the demo. After that, v1.0.0 (online 1v1) per the plan in
`docs/DESIGN.md` section 10, or any polish the review asks for.

## Milestone tracker

| Milestone | Scope | Status | Tag | Done |
|---|---|---|---|---|
| Phase 0 | Design docs, conventions, progress tracking | Done | | 2026-11-11 |
| v0.1.0 | Scaffold, tooling, design tokens, routing, auth, protected routes | Done | v0.1.0 | 2026-11-11 |
| v0.2.0 | Battle engine with full tests | Done | v0.2.0 | 2026-11-11 |
| v0.3.0 | Webcam, MediaPipe overlay, keyboard detector, recorder route | Done | v0.3.0 | 2026-11-11 |
| v0.4.0 | Battle page vs bot, results, match saved to Supabase | Done | v0.4.0 | 2026-11-11 |
| v0.5.0 | Practice, Jutsu Book, Match History, Settings | Done | v0.5.0 | 2026-11-11 |
| v0.6.0 | Training script, ML detector wired in, polish, README, Vercel config | Done | v0.6.0 | 2026-11-11 |
| v1.0.0 | Online 1v1: matchmaking, WebRTC video, Realtime signalling, sync, disconnects | Planned | | |

Statuses: Planned, Not started, In progress, In review, Done, Blocked.

## Update log

Newest first. One heading per day; each bullet names its branch and says what changed and why
it matters.

### 2026-11-11

- `feat/sign-pad`: Testing without a camera. In keyboard mode the battle and practice pages no
  longer request the camera (the self panel says so), and the key map is a sign pad: each tile
  is a button that holds its sign for the full hold time on a click, or for as long as it is
  pressed. The buttons go through the keyboard detector, which gained `hold()`, `release()` and
  a `tick()` so tests can drive it frame by frame; a test casts Fireball by clicking its three
  signs through the real detector, stabiliser and engine. Verified in headless Chrome with no
  camera permission at all: no `getUserMedia` call, a cast landed for 12 damage, a practice
  jutsu completed by clicking.
- `chore/release-0.6.0`: Closed milestone v0.6.0 with the CHANGELOG entry and this status
  update. Tagged v0.6.0. The single-player demo is complete; live accounts and real-hand
  recognition wait on the owner's Supabase project and recordings.
- `docs/readme`: The README now explains what the game is, setup with and without Supabase,
  the keyboard map, the recorder-to-model workflow, every command, how the source tree is
  split (pure engine, interchangeable detectors, content config), deployment notes and the
  branch rules, with nine screenshots from headless Chrome in `docs/screenshots/` including a
  won match and the webcam camera check.
- `chore/vercel-config`: `vercel.json` for a static Vite deployment: SPA rewrite (a missing
  model file falls through to index.html, which the app reads as "not installed"), camera
  allowed for the site's own origin, nosniff, referrer and framing headers, immutable caching
  for hashed assets and an hour for the model. Nothing is deployed by it.
- `feat/ml-detector`: Webcam play is wired through. The browser evaluates the exported MLP in
  plain TypeScript (zod-validated file, shape checks per layer, standardise, relu, softmax); a
  model store fetches `public/models/signs-v1.json` once at startup and tells "missing" from
  "broken". `MlSignDetector` turns the page's landmark frames into hands-v1 features,
  probabilities, a moving average and a sign, through the same stabiliser as the keyboard. The
  pre-battle check now runs the real detector on the preview and asks the player to hold Ram,
  so camera, tracking, model and hold rule are proven before a fight; without a model it says
  keyboard mode is available, Practice falls back to the keyboard, and the recorder shows the
  live prediction so a new model can be judged by eye. Smoke-tested in headless Chrome with a
  synthetic model and without one, no console errors.
- `feat/ml-training`: The trainer exists as a uv project in `ml/`. It loads recorder exports,
  re-implements the hands-v1 features in Python (a golden file written by the TypeScript
  extractor proves they match to 1e-6), splits validation by recording session, augments with
  jitter, scale, rotation and optional mirroring, trains the 131 → 128 → 64 → 13 MLP with
  class weights and early stopping, prints per-class recall, and exports the browser JSON. A
  pure-numpy forward pass over the export must agree with the torch model before it is
  written. `uv run pytest` passes, including an end-to-end training smoke test.
- `feat/match-history`: Match History lists your matches from Supabase newest first: date,
  opponent, result with how it ended, duration, HP left, the jutsu used as seals with counts
  and an overflow mark, a summary sentence from count queries, result and difficulty filters,
  "Load more" paging by cursor, and loading, empty, filtered-empty, error and no-account states.
  Tagged v0.5.0.
- `feat/practice`: Practice is complete. The list page offers free practice and every jutsu;
  the jutsu page shows the camera with the readout, the sequence stamping sign by sign with a
  hold ring on the current one, a shake on a wrong sign, the jutsu name stamping on completion,
  and time, best, attempts and completions. The tracker is pure and tested with the same reset
  rules as the battle buffer; without a recognition model the page falls back to the keyboard
  and says so. Verified in headless Chrome: Fireball completed in 1.2 s with no console errors.
- `feat/jutsu-book`: The Jutsu Book lists every jutsu by element in cycle order (name, element
  seal, the sequence as seals with sign names, damage read from the balance config, what it
  beats and loses to, a Practice link) plus Substitution with its cooldown, and a reference for
  all twelve signs: glyph, name, written pose, the bound key, and the recorded hand skeleton once
  `src/content/sign-references.json` has an entry from the recorder's "Save as reference".
- `feat/settings`: Settings is complete: theme, input mode, camera (device picker that learns
  names after permission, a test preview, mirror, landmarks, detection threshold), key bindings
  with conflict refusal and reset, audio levels stored for later, and the account section with
  username change, availability check and log out. Each section flashes "Saved" on change.
  Settings now sync with the `user_settings` row: the stored blob wins on sign-in, and every
  change writes through, debounced.
- `feat/results-and-persistence`: The results page shows the result word, how the match ended
  and in how long, the jutsu used with counts, damage dealt and taken, HP left, clashes and
  Substitutions, with Rematch, Change difficulty and Back to menu. Finished matches are saved
  to the `matches` table; a failed save is queued in localStorage and retried on the next
  sign-in, and the page says which of those happened. Tagged v0.4.0.
- `feat/battle-page`: The game is playable with the keyboard. A BattleController wires engine,
  detector, stabiliser, opponent and a pause-aware clock, tested with a fake detector and a
  scripted opponent. The pre-battle page offers the three difficulties, the input mode and a
  camera check that explains the missing recognition model. The battle stage follows the design:
  HP bars draining toward the centre with a damage ghost, timer, flight strip with clash bursts
  and dodge marks, two video panels, the Substitution cooldown seal, both trails with the
  candidate jutsu name, the countdown stamp, pause and forfeit dialog, result word, a live
  region for hits, and a compact key map in keyboard mode. Dev builds without Supabase get a
  "Continue as dev user" button so the game can be played before accounts are configured.
- `feat/bot-opponent`: The OpponentSource contract and the bot behind it. Three difficulties
  from the balance table: sign pace with jitter, think time, long-jutsu preference, misfires
  that reset its own buffer, reading the player's opener to counter with the advantaged
  element, Substitution reactions that respect its cooldown, and the hard bot's clash timing.
  All randomness comes from a seeded PRNG, so a match replays from its seed; tests drive the
  bot against the real engine.
- `feat/camera-mediapipe`: The detection layer (one branch instead of the three planned, since
  the pieces share one contract). Camera service with permission, not-found, in-use and
  unplugged errors; MediaPipe hand tracking loaded on demand with GPU then CPU fallback and a
  landmark overlay drawn outside React's render cycle; the 131-feature "hands-v1" extractor with
  invariance tests; the keyboard detector (twelve keys, same 250 ms hold as the webcam);
  VideoPanel and DetectionReadout components; and the dev-only recorder that captures
  labelled landmark samples with a countdown, undo, import and export, plus "Save as
  reference" for the Jutsu Book. Driven end to end in headless Chrome with a fake camera.
  Tagged v0.3.0.
- `feat/engine-core`: The battle engine exists and is fully tested: sign buffer with prefix
  matching, mismatch restarts and the 2.5 s timeout; automatic casting; 1.5 s flight; instant
  clashes with the 1.5x and 0.5x multipliers; Substitution with its 8 s cooldown and the whiff
  rule; KO, double-KO draw, round timer and forfeit; per-player stats. It is pure TypeScript,
  deterministic, driven by timestamps, and type-checked without the DOM lib. The stabiliser
  (250 ms hold, release rule) and the roster validator ship with it. Tagged v0.2.0.
- `feat/content-config`: The approved roster is now code: eleven jutsus with their sequences,
  themed names and flavour lines, and the complete balance config (damage table, clash
  multipliers, cooldown rules, round timer, bot parameters per difficulty). Tests pin the
  roster invariants: prefix-free, one opener per element, no repeated signs, every length in
  the damage table.
- `feat/supabase-auth`: Real accounts. Three migrations create `profiles` (filled by a trigger
  from the username given at sign up), `matches` and `user_settings`, all with Row Level
  Security so a player only ever sees their own rows, plus a security-definer function the
  signup form uses to check username availability. The app's auth provider now talks to
  Supabase: session restore, sign up with the confirm-email state, log in, log out, typed
  error mapping. Without environment variables the app still boots and says accounts are not
  configured. Tagged v0.1.0.
- `feat/routing-shell`: React Router 8 with every v1 route in place. Landing (headline, the
  animated sign wheel, how a duel works, the element cycle), Home (brush index with a preview
  panel), Login, Signup (with debounced username check) and Settings (theme control) are built to
  the design doc; the other pages are honest stubs naming their milestone. Protected routes
  redirect to login with a return path, signed-in players skip the public pages, screens below
  1024 px get the desktop-only notice, and dev routes exist only in dev builds. Auth runs
  against a placeholder provider until Supabase lands.
- `feat/design-tokens`: Design tokens for the dark and light themes, self-hosted fonts, the
  themed content config (names, sign pose descriptions, difficulty names), a validated settings
  store that persists the theme and applies it before first paint, and the first primitives:
  Button, Seal with eighteen original glyphs, text and password fields, Toggle, Select, Slider,
  SegmentedControl, Banner, Dialog, Toast, empty and error states, PageShell and the desktop-only
  notice. Everything the pages need to look like the design doc.
- `chore/scaffold`: Vite 8, React 19, TypeScript 5.9, ESLint 10 with type-aware rules, Prettier
  and Vitest 5 are in place and `npm run check` is green. The engine has its own DOM-free
  type-check config, and its first module defines the sign, element and player identifiers.
- `docs/progress-tracker`: The owner approved Phase 0. The element tell, the 120 s round timer,
  the Substitution whiff cooldown and instant clash resolution stay as proposed; the visual
  direction is approved with a light theme added. The docs now record the decisions, the
  light-theme tokens and the Theme setting. Phase 0 is done and v0.1.0 starts.
- `docs/progress-tracker`: At the owner's request, removed the commits and the
  `docs/design-doc-alt` branch that a second, parallel Claude session had added on 2026-11-09.
  History now holds a single set of design docs (the first session's). Two sessions should not
  work in this checkout at the same time.
- `docs/progress-tracker`: Added this progress tracker, the `update-progress` skill that
  maintains it, and a Stop hook that refuses to end a Claude Code turn while the current branch
  has commits missing from this log. Progress now stays current without anyone remembering to
  do it.

### 2026-11-09

- `docs/design-doc`: Wrote the product and technical design (`docs/DESIGN.md`): v1 scope, user
  flows, combat rules with the balance config shape, an 11-jutsu roster proposal, the sign
  recognition pipeline and classifier export format, engine, event and opponent architecture,
  the Supabase data model with RLS, the online 1v1 plan, milestones, open questions and
  assumptions.
- `docs/design-doc`: Wrote the front-end design (`docs/FRONTEND_DESIGN.md`): indigo ink and
  paper direction with the seal as the single ornament, tokens, original iconography plan,
  component inventory, and layouts with empty, loading and error states for every screen.
- `docs/design-doc`: Added `CLAUDE.md` conventions, started `CHANGELOG.md`, normalised line
  endings to LF.
- `main`: Initialised the repository with `.gitignore`, `.env.example` and a README stub.

## Roadmap

### Now: the owner's review of the v1 demo

v0.1.0 to v0.6.0 are done (tracker above). Open for the owner: create a Supabase project and
try accounts and history live; record sign sessions and train the first real model; decide
whether to deploy to Vercel; report anything the review turns up as `fix/` branches.

### Next: online 1v1 (v1.0.0)

Designed in `docs/DESIGN.md` section 10 and built after the demo ships: queue-based
matchmaking in Postgres, Supabase Realtime for signalling and fallback game messages, WebRTC
peer-to-peer video with a data channel for input, a host-authoritative engine with 500 ms
snapshots, disconnect handling with a 20 s forfeit, and online matches recorded in history.

### Later

- Anti-cheat: server-side replay of event logs, cadence limits, signed results.
- Ranked ladder and seasons; friends list, direct challenges, private lobbies.
- Sound design and real visual effects on the engine event bus.
- Spectating and replays built on the deterministic event log.
- Worker-based detection, self-hosted MediaPipe assets, mobile exploration.

## Decisions pending

Detailed in the design docs. Resolved items move into the update log with the decision.

- None blocking. The rules and the visual direction were approved on 2026-11-11.
- Proceeding on defaults the owner can still override: roster names, match history detail, auth
  rules, GitHub remote, package managers, small-screen threshold, keyboard tempo, model and
  feature spec, training data in git, the `main.py` stub, bot naming, browser support, licence
  (DESIGN.md section 13 items 1 and 6 to 17; defaults in section 14).

## How this file is maintained

- The `update-progress` skill (`.claude/skills/update-progress/SKILL.md`) defines how entries
  are written. Run it with `/update-progress`, or let Claude run it after committing.
- A Stop hook (`.claude/hooks/progress-check.mjs`, wired in `.claude/settings.json`) blocks the
  end of a Claude Code turn while the current branch has non-merge commits newer than this
  file's last commit, so the log cannot silently fall behind.
- Editing by hand: keep the same sections, add log entries newest first, and commit as
  `docs(progress): ...`.
