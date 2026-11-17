# Implementation status: online duel

Status of the Hand-Sign Jutsu Duel online mode specified in
`docs/handsign-duel/ALL_IN_ONE_SPEC.md`. Updated as each stage lands. Legend: [x] working,
[~] working with a documented limitation, [ ] not started.

## Stage A: workspace, shared rules, server bootstrap

- [x] npm workspace with `packages/duel-shared` and `server`; root scripts `dev:duel`,
  `duel:server`, `test:e2e`.
- [x] Shared config with every gameplay number from the spec, in one module.
- [x] Pure deterministic simulation: movement, bounds, body collision, dodge with i-frames,
  casts, projectiles with swept collision, shield, regen, KO/timeout/draw, forfeit, rematch
  reset. Unit tests cover U-01 to U-18 and U-24, U-25.
- [x] Colyseus server bootstrap with a `/health` route.

## Stage B: rooms, lobby, movement sync

- [ ] Create and join by code, two seats, third join rejected, ready flags, countdown.
- [ ] Movement through the native input channel; predicted local player, interpolated remote.

## Stage C: combat over the network

- [ ] Resources, dodge, casts, projectiles, shield, results through the room.

## Stage D: hand signs

- [ ] Server-side sequence validation, mock keys, webcam adapter using the trained model.

## Stage E: robustness, polish, tests, docs

- [ ] Reconnect grace and forfeit, rematch, ping/jitter HUD, event dedupe, e2e test.

## Mocked

- Nothing yet.

## Deferred

- Persistence (PostgreSQL), matchmaking, rankings, lag-compensated rewind, spectators.

## Known issues

- None recorded yet.
