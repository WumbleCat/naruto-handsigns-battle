# Implementation status: online duel

Status of the Hand-Sign Jutsu Duel online mode specified in
`docs/handsign-duel/ALL_IN_ONE_SPEC.md`. Legend: [x] working and verified, [~] working with a
documented limitation, [ ] not done. Last validation run: 2026-11-26.

## Working

- [x] npm workspace with `packages/duel-shared` (pure rules) and `server` (Colyseus 0.18);
  root scripts `dev:duel`, `duel:server`, `test:e2e`; `.env.example` documents
  `VITE_DUEL_SERVER_URL` and `DUEL_SERVER_PORT`.
- [x] Every gameplay number from the spec in one shared config (`packages/duel-shared/src/config.ts`).
- [x] Pure deterministic simulation stepped at 30 Hz in the spec's order: normalised movement,
  arena bounds, body collision, dodge (35 stamina, 1500 ms cooldown, 150 units in 180 ms,
  i-frames 30–150 ms), casts with wind-up and 50 % walk speed, projectiles with swept
  collision, Water Shield absorb-then-spill, HP regen 2/s after 6 s, chakra 7/s, stamina 20/s
  except while dashing, KO, 180 s timeout with higher HP winning, draw, forfeit, rematch reset.
- [x] Server-authoritative room: private two-seat rooms by id, third join rejected, ready flags,
  shared 3 s countdown, native fixed-step input channel with sanitising and idle input, zod
  validation with soft `ACTION_REJECTED` replies, per-connection rate limits and id dedupe,
  ~15 Hz state patches, numbered `GAME_EVENT`s, one `MATCH_RESULT`, 10 s reconnection grace with
  a paused clock and a 2 s resumption countdown, immediate forfeit on a second drop, rematch on a
  double vote, room disposal when empty.
- [x] Client: home (nickname, mode, create / join by code), lobby (invite code and link, seats,
  ready, mode banner, camera check), battle (HP / chakra / stamina / shield bars, timer, ping and
  jitter, canvas arena, jutsu slots with cooldowns, ordered sign progress, dodge state, help,
  countdown / GO / paused / reconnecting / result overlays), results with stats and rematch.
- [x] Local prediction (replay of unacknowledged inputs with the shared movement step, eased
  correction, snap above 80 units) and remote interpolation 100 ms behind; projectiles
  extrapolated along their velocity between patches; effects deduplicated by event id.
- [x] Mock hand signs through Q E R T Y U I, visibly labelled, through the same `SIGN` message
  and server validation as the webcam path.
- [x] Webcam hand signs through the repository's trained model (`public/models/signs-v1.json`,
  seven of its twelve labels), the existing camera and MediaPipe tracker, and the stabiliser
  (150 ms hold, 0.8 confidence, release before repeat). The camera never leaves the browser.
- [x] Automated tests: 36 shared rule tests (U-01 to U-18, U-24, U-25), 11 server integration
  tests with two SDK clients against a booted server (U-19, U-20, U-21, U-22, U-23, U-27, U-28,
  U-29), client prediction and keyboard tests (U-30), and a Playwright end-to-end match in two
  browser contexts (create, join by code, third seat rejected, ready, countdown, walk, dodge,
  Fireball lands for 28, knockout, shared Victory / Defeat, rematch resets to full bars).

- [x] Offline duel against a bot (`/duel/bot/easy|normal|hard`): the match is hosted in the tab
  by `LocalDuelMatch` on the shared simulation, with no server. The bot (`bot.ts` in the shared
  package) acts only through the request functions a player's messages reach. 10 bot tests
  (determinism, rule compliance, level ranking, evasion by level), 8 local match tests and a
  Playwright match against the bot.

## Mocked or limited

- [~] Bot difficulty is tuned on simulated matches (bot against bot and against scripted
  casters), not on people. A player who never moves loses to the easy bot in under a minute; the hard bot
  is close to unhittable at range unless it is mid-cast.

- [~] Webcam sign recognition is only as good as the shipped model, which was trained on one
  person's hands. The HUD says "Webcam signs live" only when the model, camera and tracker are
  all up; otherwise it names what is missing. It has not been evaluated for accuracy on the seven
  duel signs beyond the single-player model check (`npm run model:check`).
- [~] Latency fairness is server-receive-time only (the spec's MVP policy). No rewind or lag
  compensation; tested only on localhost.
- [~] The 180 ms dash and 350 / 500 / 250 ms casts are quantised to whole ticks (see
  DECISIONS.md).
- [~] Invite codes are Colyseus room ids (9 characters) rather than a separate short code.

## Deferred

- PostgreSQL persistence, rankings, matchmaking, spectators, replays, status effects, mobile.
- Rewind-based lag compensation (`allowRewindState`) for ranked play.
- Artificial 30 / 100 / 200 ms RTT testing; the HUD flags RTT over 150 ms or jitter over 60 ms.

## Known issues

- The ping shown in the HUD is the SDK clock's smoothed round-trip estimate; on a loaded machine it can read 100 ms or more even on localhost, which trips the weak-connection note. It is informational only.
- When both players disconnect at the same moment during play, the first drop forfeits the match
  to the second player before that player's own drop is processed; the room still disposes.
- A page reload in the lobby takes a fresh seat (no reconnection grace outside live play), so the
  old seat is released and the player may need to press Ready again.

## How to validate

```
npm run check            # lint, format, typecheck, 287 unit + integration tests
npm run test:e2e         # starts both servers if needed; a two-browser match and a bot match
npm run dev              # then open http://localhost:5173/duel and start a bot duel
npm run dev:duel         # then open http://localhost:5173/duel in two windows
```
