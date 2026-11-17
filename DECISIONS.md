# Decisions

Deviations from, and choices left open by, the online duel specification in
`docs/handsign-duel/ALL_IN_ONE_SPEC.md`. Newest first. Each entry says what the spec suggested,
what was done, and why.

## 2026-11-17

- **Built inside the existing repository as an online mode, not as a new monorepo.** The spec's
  default bootstraps a fresh pnpm monorepo. This repository already has a viable client stack
  (Vite, React 19, TypeScript strict, Vitest, ESLint, Prettier) and a working hand-sign pipeline,
  so the duel lives alongside the single-player game: `packages/duel-shared` (pure rules),
  `server` (Colyseus) and `src/duel` (client) wired through **npm workspaces**. The single-player
  game, Supabase accounts and the recorder are untouched. pnpm was not introduced because the
  repository, its docs and its CI conventions use npm.
- **Colyseus 0.18 is the installed server version** (`colyseus` 0.18.12, `@colyseus/sdk`
  0.18.10, `@colyseus/schema` 5). The room uses `defineInput` + `setFixedTimestep(…, 30)` for
  movement, `onMessage` with zod schemas (Standard Schema) for discrete actions, and
  `allowReconnection(client, 'manual')` with a room-clock grace timer. Patch rate is 66 ms.
- **Synced state is built with the `schema()` builder, not decorators**, because the repository
  compiles with `erasableSyntaxOnly` and standard TypeScript decorators are not configured.
- **The simulation is a pure module over plain objects, mirrored into the Colyseus schema after
  each tick.** Rules are unit-tested without a server; the room copies the result into the synced
  state. The cost is a field copy per tick, which is negligible for two players.
- **The invite code is the Colyseus room id.** It is short, opaque, created by the server, and
  joined with `joinById`; no second lookup table is needed. The invite URL is `/duel/<roomId>`.
  The reconnection token is separate and private, as the spec requires.
- **Client prediction and interpolation are implemented by hand on top of the native input
  channel.** Inputs travel through `room.input()` (library sequence numbers, server ack via
  `lastProcessed`), and the client replays unacknowledged inputs with the same shared
  `stepWalk` the server runs. The SDK's `Predict`/`Reconciler` helpers were evaluated; their
  reconciliation internals are not documented well enough in the installed typings to trust
  over a 60-line replay the project can test, so they are not used. Remote players are
  interpolated 100 ms behind the newest patch; projectiles are extrapolated from their velocity.
- **The arena is rendered with a Canvas 2D element, not Phaser.** Two circles, projectiles, a
  shield ring and dash trails do not need a game engine, and the repository's design system
  (tokens, components, themes) is reused for everything around the canvas. Phaser's bundle and
  React lifecycle integration were not worth it for this scope; the renderer is self-contained in
  `src/duel/render` and could be swapped.
- **Durations are quantised to whole 30 Hz ticks, rounded up.** A 350 ms cast lasts 11 ticks
  (367 ms), 500 ms lasts 15, 250 ms lasts 8 (267 ms); the 180 ms dash lasts 6 ticks (200 ms)
  but still covers exactly 150 units; i-frames are the ticks whose offset falls in 30–150 ms
  (offsets 1 to 4, i.e. 33–133 ms). The spec's millisecond values stay in the config and the
  conversion is one function (`msToTicks`).
- **Sign ids are the lowercase ids of the existing model** (`tiger`, `boar`, …), which already
  cover the seven signs the duel needs. The spec's uppercase names are display labels.
- **Test timings.** A room accepts `testTimings` (countdown, match length, reconnect grace) only
  when the server process sets `DUEL_ALLOW_TEST_TIMINGS=true`. Production ignores the option.
- **The server runs from source with `tsx`** (`npm run duel:server`); there is no bundling step
  for it. The build gate is a full typecheck of the server project plus the web build.
- **Keyboard movement and dodge keep working in webcam sign mode**, as the spec allows; the mock
  sign keys are only active in mock mode, and the HUD states which mode is live.
- **Malformed messages earn a soft rejection, not a disconnect.** Colyseus closes the connection
  when a message fails the schema passed to `onMessage`. The room validates inside its handlers
  instead and replies `ACTION_REJECTED { reason: 'invalid' }`, so a buggy or tampering client
  loses nothing but the action. Unknown message types are logged and ignored; message floods
  still close the connection.
- **The `GestureRecognizer` interface became an event source.** The spec sketches a
  frame-polling recogniser; this repository's pipeline is event-driven (tracker frames feed a
  classifier and a stabiliser that emits registered signs). `DuelSignSource` keeps the same
  swap-ability with `start`, `stop` and `onSign`; `MockSignSource` and `WebcamSignSource`
  implement it and combat code never sees which one is live.
- **No Playwright browser download.** End-to-end tests run on the installed Chrome
  (`channel: 'chrome'`), which the headless checks in this repository already use.
