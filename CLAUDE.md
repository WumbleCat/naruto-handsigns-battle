# CLAUDE.md

Project conventions for Jutsu Duel (working title). Read this before changing anything.
Product and technical design: `docs/DESIGN.md`. Visual and UI spec: `docs/FRONTEND_DESIGN.md`.

## What this is

A desktop web game where players fight by performing Naruto-style hand signs on their webcam.
v1 is a single-player demo against a bot; online 1v1 comes next and the architecture already
allows for it. Personal portfolio project that may be monetised, so: original visuals and audio
only, and every themed string in one content config so the game can be rebranded.

## Stack

- React 19 + TypeScript (strict) + Vite, React Router (data-less `createBrowserRouter`)
- Supabase: Auth (email + password + username), Postgres with RLS, Realtime later
- `@mediapipe/tasks-vision` Hand Landmarker in the browser; a plain-TS MLP for sign classification
- Vitest (node env for engine, jsdom for components), ESLint (flat config), Prettier
- CSS Modules + CSS custom property tokens; fonts via `@fontsource`
- Vercel hosting (config only; never deploy without asking)
- Package managers: `npm` for the web app, `uv` for the Python training tooling in `ml/`

## Commands

Web app (repo root):

```
npm install            install dependencies
npm run dev            Vite dev server (dev routes such as /dev/recorder enabled)
npm run build          production build
npm run preview        serve the production build
npm run lint           ESLint
npm run format         Prettier (write); `npm run format:check` in CI
npm run typecheck      tsc for the app AND tsconfig.engine.json (engine without DOM lib)
npm test               Vitest, single run; `npm run test:watch` while developing
npm run check          lint + format:check + typecheck + test; must pass before any merge
npm run db:types       regenerate src/lib/database.types.ts from the linked Supabase project
npm run dev:duel       Vite dev server plus the duel server, for the online mode at /duel
npm run duel:server    the Colyseus duel server alone (ws://localhost:2567)
npm run test:e2e       Playwright: a two-browser online duel and an offline bot duel (starts both servers if needed)
```

ML tooling (`ml/`):

```
uv sync                                        create the venv and install deps
uv run train --data data/raw/*.json --out ../public/models/signs-v1.json
uv run evaluate --model ../public/models/signs-v1.json --data data/raw/*.json
uv run pytest                                  includes the TS/Python feature parity test
```

## Folder map

```
src/app          router, providers, route guards, shell
src/pages        one component per route
src/components   design-system primitives (Button, Seal, HpBar, VideoPanel, ...)
src/features     auth, battle (BattleController + HUD), practice, jutsu-book, history, settings, recorder
src/engine       PURE TypeScript battle engine, stabiliser, sequence matcher, events, types
src/detection    SignDetector interface, keyboard + ML detectors, camera, MediaPipe, features, classifier
src/opponent     OpponentSource interface, bot (remote player later)
src/content      content.config.ts (themed strings), balance.config.ts (every number), roster.ts
src/lib          supabase client, database types, settings schema (zod), api/*.ts, utils
src/styles       tokens.css, global.css
src/duel         the duel client: net (SDK, session, prediction), local (offline bot match), input, render, hud, pages
packages/duel-shared   PURE rules of the duel: config, simulation, movement, bot, protocol schemas
server           Colyseus 0.18 server for the online duel: DuelRoom, synced state, limits
docs/handsign-duel     the online duel specification (verbatim); DECISIONS.md and IMPLEMENTATION_STATUS.md at the root
supabase/migrations   NNNN_description.sql, RLS on every table
ml/              uv project: train, evaluate, tests
public/models/   exported classifier JSON
docs/            design docs, screenshots
```

## Architecture rules

1. `src/engine/**` imports nothing from React, the DOM, or outside `src/engine` and
   `src/content`. No `Date.now`, no timers, no randomness: time arrives as a parameter. Enforced
   by ESLint `no-restricted-imports` and `tsconfig.engine.json` (`lib: ["ES2022"]`). Every rule
   change comes with a test.
2. The engine emits typed `EngineEvent`s; UI, bot and future effects subscribe. Do not add
   presentation concerns to the engine.
3. Sign input goes through `SignDetector` (keyboard, ML). Opponents go through `OpponentSource`
   (bot, remote). Battle code must never know which implementation it has.
4. Every tunable number lives in `src/content/balance.config.ts`. Every themed or
   Naruto-flavoured string lives in `src/content/content.config.ts`. Code uses neutral IDs
   (`fire_short`, `tiger`). If you type a jutsu name or an HP value anywhere else, stop and move
   it.
5. Roster invariants (prefix-free, no repeated consecutive signs, lengths in the damage table)
   are tested; changing the roster means running the tests.
6. Dev-only routes are registered only when `import.meta.env.DEV || VITE_ENABLE_DEV_TOOLS === 'true'`.
7. Webcam frames never leave the device. Recordings store landmarks only.
8. Supabase: the browser only ever holds the anon/publishable key; RLS on every table; access
   goes through typed functions in `src/lib/api/`. Schema changes are migrations, never dashboard
   edits; regenerate types after a migration.
9. The online duel (`/duel`) is server-authoritative. `packages/duel-shared` is pure TypeScript
   (no DOM, no timers, no randomness) and holds every duel number in `config.ts`; the server
   room only validates requests and steps the simulation; the client sends intent and renders.
   Nothing a client sends may set hp, damage, position or a winner. Rule changes come with a
   test in `simulation.test.ts`; deviations from the spec go in `DECISIONS.md`.

## UI rules

- Follow `docs/FRONTEND_DESIGN.md`. Use the `frontend-design` skill for any new UI work.
- Tokens only: no raw hex, px spacing or ad-hoc radii in component CSS. Element colour via
  `data-element` and `--element-color`, never per-element class names.
- Element is never conveyed by colour alone; seals carry glyph and `aria-label`.
- Sentence case everywhere. Buttons say what happens ("Start battle", "Save username"). Errors
  say what happened and what to do next. No tracked capitals, no middle-dot separators, no
  decorative numbering.
- Respect `prefers-reduced-motion` per the motion table; keep focus rings visible.
- Desktop only: layout for 1280 px+, hard notice below 1024 px, soft banner 1024–1279 px.

## Code conventions

- TypeScript strict, `noUncheckedIndexedAccess` on. No `any`; validate external data (Supabase
  rows, JSON files, localStorage) with zod at the boundary.
- Named exports only; one component per file; co-locate `Component.module.css` and
  `Component.test.tsx`.
- Tests sit next to source as `*.test.ts(x)`. Engine tests run in the node environment; component
  tests opt into jsdom with `// @vitest-environment jsdom`.
- Prettier: 2 spaces, single quotes, semicolons, trailing commas, print width 100. Don't argue
  with the formatter.
- Dependencies: add one only when it replaces meaningful code; say why in the commit body.
- Comments explain why, not what. Keep functions small enough to read without scrolling.

## Git workflow (required)

- `main` always builds and passes `npm run check`. Never commit directly to `main` after the
  initial scaffold.
- One branch per unit of work: `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`,
  `test/<name>`. Branch from an up-to-date `main`.
- Conventional Commits with a scope where useful: `feat(engine): add clash resolution`,
  `fix(detection): keep handedness stable when mirrored`, `docs:`, `refactor:`, `test:`, `chore:`.
- Small atomic commits: one logical change each, body explains why when it isn't obvious. No
  "wip" or catch-all commits. Commit messages end with
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Before merging: `npm run check` passes (and `uv run pytest` if `ml/` changed). Merge with
  `git merge --no-ff <branch>` so branch history stays visible. If a GitHub remote exists, open a
  pull request with `gh pr create` instead and summarise the change in the description.
- Tag each completed milestone (`v0.1.0`, `v0.2.0`, ...) with an annotated tag and update
  `CHANGELOG.md` (Keep a Changelog format) in the same milestone.
- Commit `.env.example`; never commit `.env`, `.env.local` or any secret. `.gitattributes`
  normalises line endings to LF.
- Phase 0 design docs live on `docs/design-doc`.

## Progress tracking (required)

- `docs/PROGRESS.md` is the living status page: where the project is, a milestone tracker, a
  dated update log, the roadmap and pending decisions. Update it after every commit, merge, tag
  or scope change by following the `update-progress` skill
  (`.claude/skills/update-progress/SKILL.md`, invoked as `/update-progress`).
- A Stop hook (`.claude/hooks/progress-check.mjs`, configured in `.claude/settings.json`)
  blocks the end of a turn while the current branch has non-merge commits newer than the file's
  last commit. Do not work around it; update the file and commit it as `docs(progress): ...`.
- `CHANGELOG.md` is separate: per-version release notes, updated at each tag.

## Milestones

`v0.1.0` scaffold, tokens, routing, auth → `v0.2.0` engine + tests → `v0.3.0` camera, MediaPipe,
keyboard detector, recorder → `v0.4.0` battle vs bot, results, persistence → `v0.5.0` practice,
jutsu book, history, settings → `v0.6.0` training script, ML detector, polish, README, Vercel
config. Details and branch plan in `docs/DESIGN.md` section 12; live status in
`docs/PROGRESS.md`. Give the owner a short summary at each tag.

## Do not

- Deploy to Vercel, create Supabase projects, or push to a remote without being asked.
- Use copyrighted art, audio or franchise names in the app. The working title "Jutsu Duel" is
  fine; the franchise name is not.
- Put themed strings or tunable numbers outside `src/content/`.
- Import React or DOM APIs into `src/engine/`.
- Skip hooks, force-push shared branches, or amend published commits.
