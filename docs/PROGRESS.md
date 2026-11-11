# Progress and roadmap

Last updated: 2026-11-11. Branch: `docs/progress-tracker`.

This is the living status page for Jutsu Duel. It answers three questions: where the project
is, what changed recently, and what comes next. Release notes by version live in
`CHANGELOG.md`; design detail lives in `docs/DESIGN.md` and `docs/FRONTEND_DESIGN.md`. The
`update-progress` skill keeps this file current after every commit (see the last section).

## Where we are

Phase 0 (design) is written and waiting for the owner's review. No application code exists yet,
so there is nothing to run. `main` holds only the repository scaffold. The design documents sit
on `docs/design-doc`, and this tracker, the skill and the hook that maintain it sit on
`docs/progress-tracker` (branched from `docs/design-doc`, so it contains both).

Next action: the owner reviews the open questions in `docs/DESIGN.md` section 13 and the
yes/no decisions in `docs/FRONTEND_DESIGN.md` section 10. After approval, both branches merge
into `main` with `--no-ff` and milestone v0.1.0 starts on `chore/scaffold`.

## Milestone tracker

| Milestone | Scope | Status | Tag | Done |
|---|---|---|---|---|
| Phase 0 | Design docs, conventions, progress tracking | In review | | |
| v0.1.0 | Scaffold, tooling, design tokens, routing, auth, protected routes | Not started | | |
| v0.2.0 | Battle engine with full tests | Not started | | |
| v0.3.0 | Webcam, MediaPipe overlay, keyboard detector, recorder route | Not started | | |
| v0.4.0 | Battle page vs bot, results, match saved to Supabase | Not started | | |
| v0.5.0 | Practice, Jutsu Book, Match History, Settings | Not started | | |
| v0.6.0 | Training script, ML detector wired in, polish, README, Vercel config | Not started | | |
| v1.0.0 | Online 1v1: matchmaking, WebRTC video, Realtime signalling, sync, disconnects | Planned | | |

Statuses: Planned, Not started, In progress, In review, Done, Blocked.

## Update log

Newest first. One heading per day; each bullet names its branch and says what changed and why
it matters.

### 2026-11-11

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

### Now: Phase 0 review

Owner decisions are needed on the roster, the element-tell rule, the round timer, Substitution
whiffs, clash timing, auth details, package managers and the visual direction. Full lists:
`docs/DESIGN.md` section 13 and `docs/FRONTEND_DESIGN.md` section 10.

### Next: the v1 demo against the bot (v0.1.0 to v0.6.0)

In order, each tagged when done. Branch plan in `docs/DESIGN.md` section 12.

1. v0.1.0: Vite, TypeScript, ESLint, Prettier and Vitest; design tokens and primitives; router,
   page stubs, 404 and the desktop-only notice; Supabase client, migrations, auth pages, profile
   trigger and protected routes.
2. v0.2.0: Content, balance and roster config; the deterministic battle engine; the stabiliser;
   the full test suite (damage table, element cycle, clash, Substitution, cooldown, buffer reset,
   KO).
3. v0.3.0: Camera service, MediaPipe hand tracking with the landmark overlay, keyboard detector,
   feature extractor, `/dev/recorder`.
4. v0.4.0: Bot with three difficulties, battle controller and HUD, results page, match
   persistence.
5. v0.5.0: Practice, Jutsu Book, Match History, Settings.
6. v0.6.0: `/ml` training and evaluation with uv, ML detector wired in, polish pass, README with
   setup and screenshots, Vercel config (no deployment without approval).

### After v1: online 1v1 (v1.0.0)

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

- Roster sequences, lengths and themed jutsu names (DESIGN.md section 6).
- Whether the first sign should reveal the element (DESIGN.md 13.2).
- Round timer, Substitution whiff rule, clash timing (DESIGN.md 13.3 to 13.5).
- Match history detail, auth rules, GitHub remote, package managers, small-screen threshold,
  keyboard tempo, model and feature spec, training data in git, the `main.py` stub, bot naming,
  browser support, licence (DESIGN.md 13.6 to 13.17).
- Palette, typefaces, Home layout, flight strip, skeleton references, single dark theme
  (FRONTEND_DESIGN.md section 10).

## How this file is maintained

- The `update-progress` skill (`.claude/skills/update-progress/SKILL.md`) defines how entries
  are written. Run it with `/update-progress`, or let Claude run it after committing.
- A Stop hook (`.claude/hooks/progress-check.mjs`, wired in `.claude/settings.json`) blocks the
  end of a Claude Code turn while the current branch has non-merge commits newer than this
  file's last commit, so the log cannot silently fall behind.
- Editing by hand: keep the same sections, add log entries newest first, and commit as
  `docs(progress): ...`.
