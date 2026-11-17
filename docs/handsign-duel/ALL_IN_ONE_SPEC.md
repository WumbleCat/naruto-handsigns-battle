# Hand-Sign Jutsu Duel — All-in-One Build Specification

This is the specification the owner supplied on 2026-11-17 for the online 1v1 mode, kept verbatim
in the repository so it survives as the canonical reference. Follow `AGENTS.md` instructions first;
use the master prompt near the end to launch implementation. Decisions taken while adapting it to
this repository are recorded in `DECISIONS.md` at the repository root.

---

## FILE: README.md

Hand-Sign Jutsu Duel — 1v1 Multiplayer Build Specification
Status: Implementation-ready prototype specification
Format: Markdown for Claude Code, Codex, Cursor and other coding CLIs
Updated: 2026-11-17

### What to build

A desktop-browser, real-time, online, exactly-two-player 1v1 jutsu duel. Both players can move,
dodge projectiles, regenerate health/chakra/stamina, perform hand-sign sequences to cast jutsus,
shield attacks, and win a timed match. The client renders the battle and recognises hand signs; a
server-authoritative simulation owns damage, regeneration, resources, dodge invulnerability,
projectiles and match results.

It must be playable in two browser tabs without a trained hand-sign classifier: keyboard-based mock
hand-sign input is mandatory. An actual webcam detector connects through the recogniser adapter when
available. Do not pretend MediaPipe landmarks already classify named jutsu signs.

### Fastest way to use these docs in your coding CLI

Copy the entire folder into the root of your project, under `docs/handsign-duel/` (you can also put
`AGENTS.md` at the root). Open the project in Claude Code / Codex. Give it this instruction:

> Read `docs/handsign-duel/BUILD_PROMPT.md`, `docs/handsign-duel/AGENTS.md`, and every linked
> specification. Implement the project in the current repository, adapting to existing code safely.
> Build and test each vertical slice, and report what works, what is mocked, and what still needs a
> trained gesture model.

For a single-file handoff, use `ALL_IN_ONE_SPEC.md`, generated from the individual docs.

### Documents in order

| File | Purpose |
|---|---|
| `AGENTS.md` | Non-negotiable coding-agent instructions and implementation conventions |
| `01_PRODUCT_REQUIREMENTS.md` | User experience, scope, flows and MVP definition |
| `02_GAMEPLAY_RULES.md` | Precise movement, regen, dodge, casting, jutsu, collisions and match rules |
| `03_TECHNICAL_ARCHITECTURE.md` | Stack, monorepo, server loop, state ownership and data model |
| `04_NETWORK_PROTOCOL.md` | WebSocket/Colyseus messages, state sync, ping and reconciliation |
| `05_HANDSIGN_RECOGNITION.md` | Local webcam model integration, smoothing, gesture-to-cast validation |
| `06_UI_AND_UX.md` | Screen layout, HUD, animations, control scheme and error states |
| `07_IMPLEMENTATION_AND_TESTING.md` | Build phases, test cases, acceptance gates and security |
| `BUILD_PROMPT.md` | Copy/paste agent instruction, implementation sequence and completion standard |
| `ALL_IN_ONE_SPEC.md` | Entire specification combined in one Markdown file |

### Baseline architecture

- Client: Vite + React + TypeScript + Phaser (2D top-down battle scene).
- Server: Node.js + TypeScript + Colyseus 0.18-compatible APIs, one game room per match,
  `maxClients=2`.
- Shared: TypeScript types, constants and deterministic movement calculation.
- Input: WASD movement, Space dodge, hand signs for jutsus, mock keyboard hand signs for testing.
- Camera: `getUserMedia` and optional MediaPipe hand landmarks / user's existing trained classifier,
  processed locally.
- Storage: In-memory for local MVP. PostgreSQL for persistent users, rankings and match history in a
  subsequent milestone; Redis only if scaling to multiple processes.

Colyseus v0.18 includes fixed timestep inputs, prediction and reconciliation, interpolation and
server rewind primitives. Check installed APIs and the official docs before coding, because older
Colyseus tutorials use incompatible imports and types. Use Phaser purely for client rendering, not as
authority for server damage or collisions.

### Source documentation (official)

- https://docs.colyseus.io/getting-started
- https://docs.colyseus.io/room
- https://docs.colyseus.io/state
- https://docs.colyseus.io/netcode
- https://docs.colyseus.io/netcode/server-input
- https://docs.colyseus.io/netcode/client-prediction
- https://docs.phaser.io/phaser/getting-started/installation
- https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker

These are technical references, not substitutes for the gameplay rules in this packet.

---

## FILE: AGENTS.md

Coding Agent Instructions — Hand-Sign 1v1 Duel

### Mission

Implement a fully runnable and testable multiplayer 1v1 browser game from the specification in this
directory. Make the smallest reliable vertical slice first, then layer in mechanics. The client
should be responsive and enjoyable even without camera recognition. Treat `02_GAMEPLAY_RULES.md`
and `04_NETWORK_PROTOCOL.md` as canonical for gameplay semantics.

### Before changing anything

- Inspect the existing repository, dependency files, project layout and existing hand-sign
  model/recognition code. Preserve usable code and user changes.
- If the repository already has React, Phaser, a recogniser, or a backend, adapt instead of
  overwriting blindly. If absent, create the default architecture in `03_TECHNICAL_ARCHITECTURE.md`.
- Verify the installed Colyseus version and API against its official documentation. Target
  0.18-compatible libraries, do not copy outdated 0.15/0.16 APIs. The official Colyseus coding skill
  is an optional reference: `npx skills add colyseus/skill`.
- Do not make unverifiable claims that webcam landmarks alone can identify Tiger/Rat/etc. If no
  trained classifier is present, create the adapter + camera preview + explicitly labelled mock input.

### Hard requirements

- Exactly two player slots per room; waiting room / code invite / ready / countdown / active /
  end-of-match.
- Server calculates and validates all health, chakra, stamina, regen, movement boundaries,
  collisions, dodge invulnerability, shields, cast starts, cooldowns and winner.
- Deterministic shared movement function; fixed 30 Hz simulation; network state patches nominally
  15 Hz; UI rendered at display frame rate.
- Health regeneration after not taking damage; continuous chakra and stamina regeneration;
  stamina-costing dodge with i-frames and cooldown.
- Three specified jutsus with their distinct hand signs; projectile combat and defensive shield.
- Match works end-to-end from two independent browser tabs, no database or camera required in mock
  mode.
- Camera runs locally, with visible privacy notice, no frame streaming or storage by default.
- Input/rate validation; no trust of client-side damage, positions, resources, timestamps or
  victory.
- Temporary connection loss with reconnection grace and forfeit policy.
- Responsive screen layout with HP/chakra/stamina bars, cooldowns, current sign sequence, match
  timer, ping/jitter, reconnect/errors.
- Automated tests for rules, server ownership, two-client sync, bad inputs and end-of-match.

### Engineering conventions

- TypeScript strict mode. Shared constants and type definitions. Prefer pure functions for the
  simulation and unit tests.
- All world coordinates in world units, all simulation times in server ticks or monotonic server
  milliseconds; never use browser `Date.now()` as authoritative time.
- Normalise diagonal movement and dodge direction. Clamp resources to `[0, max]`. Do not apply
  dt-dependent damage twice.
- Network commands carry monotonic sequence numbers or library-managed equivalent. Deduplicate
  events.
- Separate authoritative `RoomState`, transient events, client-only camera UI, and server-only
  per-connection telemetry.
- No overengineered microservices, Kubernetes, authentication product, payment system or
  leaderboard needed to ship the MVP.
- If the existing project differs, clearly document the adaptation and avoid deleting unrelated
  files.
- Run formatter, linter, typechecker, test suite and a build; report failures with precise
  reproduction steps.
- Never leave dead UI controls pretending to work. If a camera classifier is missing, visibly label
  `Mock signs` and make a functioning adapter boundary.

### Progress discipline

Work in the order described in `07_IMPLEMENTATION_AND_TESTING.md`. At each phase, leave code
runnable. Write `IMPLEMENTATION_STATUS.md` in the repository with checkboxes for implemented,
mocked, deferred and blocked features. Fix failures rather than only proposing future fixes.

### Agent decisions

If a minor detail is not specified, pick the simplest approach and document it in `DECISIONS.md`;
do not pause to ask unless an existing implementation would be destroyed. If specifications
conflict, use: explicit user changes > `02_GAMEPLAY_RULES.md` > `04_NETWORK_PROTOCOL.md` > other
files > internal defaults.

---

## FILE: 01_PRODUCT_REQUIREMENTS.md

01 — Product Requirements Document (PRD)

### Product concept

Hand-Sign Jutsu Duel is a competitive online 1v1 browser game. Two users duel in a 2D arena, moving
and dodging with keyboard controls while using hand-sign sequences to cast projectiles or defensive
jutsus. The value proposition is the physical satisfaction of performing a jutsu sequence under
pressure, with understandable reaction windows and fair multiplayer state.

### Players and platform

- MVP: desktop Chrome/Edge/Firefox, keyboard + webcam optional.
- Guest play: nickname and room code; no signup to try a match.
- Two separate browser sessions or machines connected to the same server; never allow a third
  battle participant.
- One round per match, 180-second timer, rematch supported if both agree (fresh state).
- Real camera is optional in development/demo. Production hand-sign play requires a separately
  supplied or developed sign classifier; keyboard mock is for prototype/testing.

### User journey

1. User opens home screen, chooses nickname and input mode (`Mock signs` or `Webcam` if configured).
2. User clicks `Create duel` and receives a short invite code / shareable URL.
3. Friend enters code or opens link and joins second slot. The room becomes full and locks.
4. Both players see their connection / camera readiness and press `Ready`.
5. Shared 3-second countdown. Start is based on a server start tick/time.
6. Players move with WASD, dodge with Space, select a jutsu with 1/2/3, and perform its ordered hand
   signs. During mock mode, mapped keyboard keys simulate sign events.
7. Server applies casts, travel and collision, HP/shield damage, regen, chakra, stamina and
   cooldowns; clients render animations and HUD.
8. Match ends on KO, 180-second timeout, or disconnect forfeit. Show result, stats and rematch /
   leave controls.

### Required screens

- Home: guest nickname, input mode, Create / Join by code.
- Lobby: room code, invite URL, two player slots, ready status, camera permissions, mock-mode
  banner, settings, leave button.
- Battle: arena, two avatars, effects, HP/chakra/stamina bars, timer, current jutsu + sign
  progress, three cooldowns, dodge availability, ping/jitter, local webcam preview, controls/help.
- Results: winner, outcome reason, damage dealt, jutsus cast, dodges, remaining HP, rematch.
- Error states: no camera permission, unsupported browser, invalid/expired/full room code,
  connection interrupted, opponent left, server unavailable.

### Functional requirements

| ID | Requirement | Verification |
|---|---|---|
| F-01 | Exactly two simultaneous live players per match | Third join is rejected |
| F-02 | Create and join duel using code/URL | Two browser contexts can meet |
| F-03 | Ready/check + synchronised countdown | Both see same active start |
| F-04 | Move in all directions inside arena | Normalised, bounded movement |
| F-05 | Dodge dash with stamina, cooldown and i-frames | Timed projectile collision tests |
| F-06 | HP regen after out-of-damage delay | Fixed timestep unit test |
| F-07 | Chakra/stamina regen continuously | Fixed timestep unit test |
| F-08 | 3 jutsus: Fireball, Lightning Spear, Water Shield | Config / combat test |
| F-09 | Ordered hand-sign sequences | Correct sequence accepts; wrong resets |
| F-10 | Mock hand-sign input | Full battle without camera/model |
| F-11 | Optional real webcam recogniser adapter | No frame transmission |
| F-12 | Server-authoritative attacks and outcomes | Tampered client commands rejected |
| F-13 | Ping/jitter and connection state visible | HUD shows current measurements |
| F-14 | Timeout, KO, disconnect, draw and rematch | End-to-end tests |
| F-15 | Attack/dodge/cast audio-visual feedback | Both clients show events |
| F-16 | Debug/test diagnostics and automated tests | Repeatable local test suite |

### Non-functional requirements

- Local two-client MVP runs with a simple documented command (`pnpm dev`) after installation.
- Server fixed-step simulation = 30 Hz; room patch frequency target = 15 Hz. UI render target =
  60 FPS on typical desktops, without making 60 FPS a gameplay requirement.
- Inputs should feel immediate through predicted local movement / VFX. Remote avatars interpolated
  smoothly. Server verdict overrides any predicted result.
- Support normal 30–200 ms RTT in a playable way; show degraded network warning rather than claiming
  guaranteed fairness under very poor networks.
- Server does not store or forward raw webcam video/frames by default; camera never starts before
  permission.
- Core combat is easy to rebalance through `shared/gameConfig.ts` (not magic numbers scattered
  across code).
- Clear error handling and explicit reconnection states; no indefinite hanging match.

### MVP vs future

Must ship in MVP: Guest rooms, two players, movement, dodge, all three resource bars and regen,
three jutsus, hand-sign mock, local webcam hook, health/shield damage, authoritative simulation,
winner, responsive UI, ping/jitter, tests.

After MVP: Real classifier training/export if missing, advanced gesture anti-cheat, skin selection,
richer status effects (burn/stun), spectators, ranked matchmaking, skill ratings, replay and
telemetry dashboards, persist match records in PostgreSQL, Redis/multinode deployment, mobile
gestures.

### Product success checks

Two humans should be able to open the game in separate browsers, join by a code and complete a
whole duel. A player should be able to visibly dodge a projectile, lose stamina, see stamina
regenerate, take damage, recover HP after the delay, cast multiple jutsus through ordered signs and
finish with a correct shared result. This is the MVP bar, not a static UI mock.

---

## FILE: 02_GAMEPLAY_RULES.md

02 — Canonical Gameplay Rules & Balance

These values are starter balance, intentionally defined exactly so the coding agent does not invent
different rules. Keep them editable in one shared `gameConfig` module and test the initial values.

### Arena / simulation

| Constant | Value |
|---|---|
| World / arena | 1200 × 700 world units, 2D top-down |
| Player collision radius | 22 units |
| Player 1 spawn | (150, 350) |
| Player 2 spawn | (1050, 350) |
| Movement speed | 220 units/second |
| Server simulation tick | 30 Hz (fixed `dt = 1 / 30` seconds) |
| State patch target | ~15 Hz; event messages separate |
| Client render | Display refresh rate, target 60 FPS |
| Match duration | 180 seconds active play |
| Countdown | 3 seconds |
| Player count | Exactly 2 |

WASD direction is normalised so diagonal movement is not faster. Clamp positions to world bounds,
accounting for player radius. Players cannot overlap: circle-circle collision is resolved on the
server in a stable deterministic order (fixed player ordering by ID); against wall and opponent,
movement/dash stops at the valid position. Physics is simple deterministic circle/swept-circle math;
Phaser client physics must not decide game outcomes.

### Starting player stats

| Stat | Start | Max | Regeneration |
|---|---|---|---|
| Health (HP) | 100 | 100 | 2 HP/s only after 6 s without receiving damage |
| Chakra | 100 | 100 | 7 chakra/s while playing |
| Stamina | 100 | 100 | 20 stamina/s while not dodging |

- Regen operates on server fixed ticks: `value = min(max, value + rate * dt)`.
- Health regen timer resets on any incoming positive HP damage after shield absorption. If shield
  completely absorbs a hit, do not reset it; the shield still takes damage.
- No regen during WAITING, COUNTDOWN, PAUSED, or FINISHED.
- Never exceed maximum values or drop below zero.
- Damage and regeneration order per server tick is specified below to avoid duplicate/exploit edge
  cases.

### Dodge / dash (Space)

| Property | Value |
|---|---|
| Cost | 35 stamina |
| Cooldown | 1500 ms |
| Dash duration | 180 ms |
| Distance | 150 world units when unobstructed |
| Effective dash speed | distance / duration (server simulation) |
| Invulnerability frames (i-frames) | 30–150 ms after dodge start |
| Dodge input | Space (edge-triggered, not held-repeat) |
| Direction | Normalised current WASD direction; if zero input, dash directly away from opponent |

Rules:

- Dodge only in PLAYING while alive, not already dodging, not casting, with stamina >= 35 and
  cooldown elapsed.
- Server consumes 35 stamina and starts cooldown on accepted dodge.
- Dash is a short movement with i-frames; projectiles touching the player during i-frame window do
  zero damage. Dash cannot cross bounds or pass through the other player.
- If a projectile hits before or after i-frames, damage applies normally. A projectile that
  intersects only an invulnerable player should be consumed on collision (no damage), to avoid
  future double hits.
- While dodging, ordinary walking inputs do not change motion direction; no stamina regen; cannot
  cast a jutsu.
- Failed dodge requests do not spend stamina or reset cooldown; send a lightweight rejection reason
  for HUD.
- Use an event ID / input sequence to avoid duplicate dodge from key repeats or resends.

### Casting, signs, aiming

- Three jutsu slots (keys `1`, `2`, `3`) select a desired jutsu. A selected jutsu exposes its
  required ordered sequence in UI.
- Stable recogniser events (`SIGN`) enter an authoritative sequence validator. An event is not an
  instruction to deal damage.
- Valid sign order is required; wrong sign resets progress to 0 and produces a failure cue.
  Inter-sign time limit is 3000 ms, measured using server receipt / bounded corrected time.
- After all correct signs: check match phase, alive state, no dash / existing cast, chakra,
  cooldown; if valid, begin cast and reserve/consume chakra, start cooldown. If invalid, do not
  charge, and show reason.
- Cast has wind-up. Character can move at 50% speed during wind-up, and cannot dodge or begin
  another cast. Damage does not interrupt cast in MVP; death interrupts it.
- Projectile spawns only at end of wind-up, at the caster's current position plus 40 units along
  facing direction. Facing is locked to the direction of the opponent at release, not homing
  afterwards; avoid aim-mouse complexity for sign-centric controls.
- Each projectile travels linearly, hits at most once, and expires at maximum distance/lifetime.
  Server uses swept circle-versus-circle collision or sufficiently small substeps to avoid
  tunnelling.
- Shield jutsu applies protection when its cast completes. Casting at 0 HP is impossible.
- If death occurs during a cast, no projectile or shield effect spawns; the consumed
  chakra/cooldown stay consumed.

### Jutsu catalogue

All values editable from one config. Required hand signs are placeholder names that must match the
user's model labels when integrated.

| Slot | Jutsu | Signs (ordered) | Chakra | Cast | Cooldown | Effect |
|---|---|---|---|---|---|---|
| 1 | Fireball | TIGER → BOAR → HORSE | 30 | 350 ms | 5000 ms | Projectile, 28 HP damage, speed 500 units/s, radius 24, max lifetime 1.4 s |
| 2 | Lightning Spear | RAT → BIRD → TIGER | 45 | 500 ms | 8000 ms | Fast narrow projectile, 40 HP damage, speed 900 units/s, radius 12, max lifetime 0.95 s |
| 3 | Water Shield | SNAKE → RAM | 25 | 250 ms | 9000 ms | Shield absorbs up to 38 damage for 2.5 s, no projectile |

Shield rules: If shield is active, incoming projectile damage is deducted from shield first; excess
damage spills to HP. Recasting shield is blocked by cooldown. Shield expires at 0 capacity or 2.5
seconds. If hit during dodge i-frames, consume projectile without reducing shield. UI shows current
shield capacity; shield cannot stack beyond initial 38.

### Examples

- Player 1 HP 80, shield 15. Hit by a Fireball for 28: shield goes to 0, HP goes to 67.
- Player 2 HP 50, no shield. Fireball hits: HP goes to 22. After 6 s without further HP damage, HP
  increases by 2 per second.
- Player 2 stamina 70 and successfully dodges: immediately 35, then stays at 35 for dash duration,
  afterwards regens 20 per second up to 100.
- Player 1 has 20 chakra: completing Fireball sequence causes insufficient-chakra rejection; do not
  consume chakra or start cast.

### Projectile vs player timing

Recommended per-tick processing order for repeatability:

1. Drain and validate queued inputs/sign events, update desired movement and start accepted dodge /
   cast (not their completion).
2. Update countdown/phase and timers; if match not PLAYING, stop simulation advancement.
3. Advance dodge / cast timers; update player positions with bounded collision resolution.
4. Spawn any jutsus whose cast wind-up finished; apply expiration to active shields.
5. Move projectiles; process swept collision with players and dodge windows; apply shield then HP
   damage; remove hit projectiles.
6. Remove expired projectiles/effects; process regen (health only if eligible after hit
   resolution).
7. Check winner / timeout / disconnect policy; advance tick; publish authoritative state and
   transient events.

For simultaneous projectile impacts that kill both players on the same tick, result is DRAW. At
timer expiry, higher remaining HP wins; exactly equal HP is a draw. Do not use chakra as an
undeclared tiebreaker.

### Match phase and disconnect rules

`WAITING → READY → COUNTDOWN → PLAYING → FINISHED` plus transient `PAUSED_RECONNECT` from PLAYING.

- WAITING: one or two players; not both ready. READY: two connected players with both ready flags
  set. COUNTDOWN: synchronised 3 seconds. PLAYING: timer, regen, input, combat.
- When either player disconnects during active play, pause both players' simulation and clock for
  10 seconds to allow reconnection. If the same player disconnects again in the same match, forfeit
  immediately (simple anti-abuse MVP policy).
- Reconnection within grace restores their slot, performs full state sync, resumes with a 2-second
  resumption countdown; cooldowns, regen and remaining match duration do not advance while paused.
- No reconnection by grace deadline = forfeit, opponent wins. If both leave, terminate match with no
  winner and dispose the room. On reconnection, verify a private session/resume token and avoid
  allowing another user to steal a slot.
- KO wins immediately after the server has resolved all events for the tick. Display results for
  both players, disable controls, offer rematch.
- Rematch requires both accept. Fresh room-state reset; replay countdown, no leftover
  shield/projectile/cooldown.

### State machines

- Player movement: IDLE, WALKING, DODGING, CASTING, DEAD. More than one visual state may be shown,
  but authoritative state flags/cast/dodge times determine validity.
- Hand-sign sequence: NOT_STARTED → IN_PROGRESS(index) → COMPLETE → CAST_PENDING/REJECTED → reset.
  Reset on wrong sign, sign timeout, jutsu switch (if allowed), KO, disconnect or match end. Do not
  allow switching selection once a sequence has started until reset / explicit cancel.

### Future balance hooks (not MVP blockers)

Additional jutsus, burn / stun / healing spells, parry or clash mechanics, 2-of-3 rounds, skill
ratings, controller/mobile support and match replays. Keep config extensible but do not postpone
core MVP to build them.

---

## FILE: 03_TECHNICAL_ARCHITECTURE.md

03 — Technical Architecture and Authoritative State

### Design choices

Default when bootstrapping a new repository:

- `pnpm` workspace monorepo; Node.js LTS; strict TypeScript.
- Frontend: Vite + React + Phaser 2D game scene (React owns forms, HUD, overlays; Phaser renders
  arena, player sprites, particles, attack trajectories).
- Backend: Colyseus compatible with 0.18, Node.js TypeScript, one room per 1v1 match.
- Shared package: config, named sign/jutsu IDs, messages, pure movement/collision math and unit
  tests.
- Vision: browser's camera, optional `@mediapipe/tasks-vision` for hand landmarks and an adapter for
  an actual classifier.
- DB is optional and not a dependency for first playable release. Save results to PostgreSQL in a
  later phase; Redis only when multiple server instances are needed.

Colyseus rooms are authoritative. In 0.18, fixed-step inputs (`defineInput`, `setFixedTimestep`)
and client `room.input` + `Predict` support prediction/reconciliation. Do not assume pre-0.18 API
shapes. Prefer this native mechanism to inventing a second movement protocol. Verify exact installed
APIs and code examples from docs.

### Target repository layout

```text
/
  AGENTS.md                         # Optional copy from spec pack
  package.json                      # pnpm workspace scripts
  pnpm-workspace.yaml
  .env.example
  apps/
    web/
      src/
        app/                         # Lobby, game shell, result page
        game/                        # Phaser scenes, sprites, animations
        hud/                         # React HP/chakra/stamina, timer, cooldowns
        input/                       # keyboard, camera, gesture providers
        network/                     # Colyseus room client, subscriptions
        main.tsx
    server/
      src/
        index.ts                     # Colyseus server bootstrap
        rooms/DuelRoom.ts             # One room, 2 slots, lifecycle
        state/DuelState.ts            # Synced Colyseus Schema declarations
        combat/                      # simulation, regen, dodge, projectile, cast
        security/                    # input bounds + rate/sequence validation
        matchmaking/                 # invite code to room mapping
  packages/
    shared/
      src/
        config.ts                    # canonical gameplay values
        types.ts                     # common types and IDs
        net.ts                       # commands + events
        movement.ts                  # deterministic movement helper
        collision.ts                 # pure geometry
        signs.ts                     # sequence catalogue / labels
  tests/
    integration/
    e2e/
  docs/handsign-duel/                # Original spec pack
  IMPLEMENTATION_STATUS.md
  DECISIONS.md
```

If existing repo structure already works, preserve it; these folder names are a suggested layout
rather than a forced migration.

### Clear state ownership

| Data | Source of truth | Synced? |
|---|---|---|
| HP, chakra, stamina, shield, cooldowns | Server | Yes |
| Position, dodge window, facing direction | Server | Yes |
| Match phase, tick, timer, winner | Server | Yes |
| Jutsu cast completion, spawned projectiles, hits | Server | Yes + transient events |
| Hand-sign sequence index | Server | Yes (progress), client may preview locally |
| Webcam frames / hand landmarks | Client | No by default |
| Detection confidence / local camera FPS | Client | Debug local; only accepted sign metadata sent |
| Player input intent (direction, selected slot, sign) | Client | Sent as requests; server validates |
| Ping/jitter measurements | Connection/client SDK | HUD only; optionally telemetry |
| Animation tween and particle effects | Client | No; derive from events/state |
| Persistent match statistics | Server | Results once, future DB |

### Network-synchronised schema — conceptual types

Use Colyseus `Schema`/`MapSchema` or the current schema builder; network fields must be supported
primitive types. Do not paste this plain TypeScript interface straight into Colyseus schema;
implement serialization properly.

```ts
type MatchPhase =
  | 'WAITING' | 'READY' | 'COUNTDOWN' | 'PLAYING'
  | 'PAUSED_RECONNECT' | 'FINISHED';

type PlayerNetState = {
  id: string; nickname: string; connected: boolean; ready: boolean;
  x: number; y: number; vx: number; vy: number; facing: number;
  hp: number; maxHp: number; chakra: number; maxChakra: number;
  stamina: number; maxStamina: number;
  shieldHp: number; shieldExpiresTick: number;
  dodgeStartsTick: number; dodgeEndsTick: number;
  invulnStartTick: number; invulnEndTick: number;
  dodgeReadyTick: number;
  selectedJutsuId: string; signIndex: number;
  castJutsuId: string; castEndsTick: number;
  fireballReadyTick: number; lightningReadyTick: number; shieldReadyTick: number;
  lastProcessedInputSeq: number; alive: boolean;
};

type ProjectileNetState = {
  id: string; ownerId: string; jutsuId: string;
  x: number; y: number; vx: number; vy: number;
  radius: number; damage: number; expiresTick: number;
};

type DuelNetState = {
  phase: MatchPhase; tick: number;
  activeTicksRemaining: number;
  countdownTicksRemaining: number;
  resultReason: string; winnerId: string; // '' for none/draw
  players: Map<string, PlayerNetState>;
  projectiles: Map<string, ProjectileNetState>;
};
```

Use server-only state for: last damage tick, sign event debouncing / timestamps, raw current
movement input, reconnect token, disconnection allowance, rate-limit counters, detailed stats,
authoritative input queue, server-time correction metadata, dodge direction snapshot, hit
deduplication. If any such property is needed for HUD (e.g. last damage indicator), send a derived
state or event rather than exposing secrets.

Colyseus-specific note: Current synced schema properties cannot be arbitrary nested JS objects.
Represent cooldowns as fixed primitive tick fields or supported schema subobjects, not
`Record<string, number>` without proper mapping. Avoid `null` if schema field type does not support
it. 0.18 builder and decorator variants differ.

### Room lifecycle

- `CreateDuel`: allocate room with exactly two seats, generate opaque invite code / URL, associate
  with room identifier.
- `JoinDuel`: validate code and room status, reserve free seat. Reject third join and an
  already-started match (unless valid reconnection).
- `onJoin`: attach nickname/session identity, assign spawn, send full state.
- Both `Ready`: begin countdown. New ready state is reset on leave before starting.
- Start `PLAYING` at server tick, track remaining play ticks.
- In each fixed step process validated inputs; update movement, dodge/cast/regen/projectiles/
  collisions; check end conditions.
- `onDrop`/disconnect: enter pause/grace state, allow authenticated slot recovery; decide forfeit if
  timeout.
- `FINISHED`: emit result once, rematch optional; cleanup room when participants leave.

Prefer Colyseus built-in lifecycle/reconnect support (verify 0.18 hooks and signatures) rather than
inventing custom socket-session takeover. Invite code is a public sharing token; it is not a
reconnect secret.

### Fixed-step simulation pseudocode

```ts
const DT = 1 / 30;

function stepAuthoritativeRoom(room: DuelRoom) {
  applyValidatedInputQueues(room);           // no client direct state writes
  updateRoomPhaseAndTimers(room);
  if (room.phase !== 'PLAYING') return;

  advanceDodgeAndCastTimelines(room, DT);
  movePlayersAndResolveOverlap(room, DT);
  releaseCompletedJutsus(room);
  expireShields(room);
  moveProjectilesAndResolveSweptHits(room, DT);
  expireProjectiles(room);
  regenerateResourcesAndEligibleHealth(room, DT);
  evaluateKOsAndTimeout(room);
  room.tick += 1;
}
```

Every accepted game action is processed once and gets a monotonically increasing server event ID
for visual playback and metrics. Use deterministic ordering for ties (e.g. sort player IDs, sort
projectiles by creation ID) and sample `serverTick`, not client clocks.

### Geometry details

- `normalise(moveX, moveY)` with safe zero vector.
- Player circle radius 22, projectile radius defined by jutsu.
- For projectiles, evaluate the segment from previous to new projectile position against target
  circle of `(playerRadius + projectileRadius)`, not just the endpoint. This prevents Lightning
  Spear from crossing a player between ticks.
- Upon collision, apply shield / iframe / damage once, and delete projectile. Boundary and expiry
  also remove projectile.
- If projectile crosses both the opponent and a wall in one step, resolve the earliest intersection
  fraction.
- Dash should respect the same collision boundaries, including a player's body, as ordinary
  movement.

### Local prediction and rendering

- Minimum: render input-responsive local movement immediately and reconcile to authoritative server
  position; remote player positions smoothly interpolated ~100 ms behind.
- Preferred: use Colyseus 0.18 `defineInput` / `setFixedTimestep` on server and `room.input` /
  `Predict.reconciler` on client using the same pure movement step.
- Client must never predict authoritative damage, HP loss, resource spending as committed truth, or
  winners; it can show speculative particles and casting animation and correct them when rejected.
- Server-only dodge decisions and collision/hit results override client visual prediction.
- Avoid duplicate event playback after reconnection by tracking recent server event IDs.

### Data persistence after MVP

Future tables: `users(id, display_name, created_at)`, `matches(id, started_at, ended_at, winner_id,
reason, duration, config_version)`, `match_players(match_id, user_id, damage_dealt, damage_taken,
casts, dodges, result)`, `rankings(user_id, rating, games_played, updated_at)`. Guest nicknames and
in-memory results are sufficient for first MVP. Do not require a database to join/play a game.

### Deployment

- Development: `pnpm dev` runs Vite web and Colyseus server concurrently, `.env.example` defines
  `VITE_GAME_SERVER_URL` and server port.
- Production: serve frontend over HTTPS and game WebSocket over WSS; avoid mixed content. Webcam
  requires a secure context except local development.
- One Node process can host many rooms. Production reverse proxy must support WebSocket upgrades;
  use health probes, graceful room shutdown and bounded room count.
- Only add Redis/distributed presence and persistent DB once a single-process MVP works.

---

## FILE: 04_NETWORK_PROTOCOL.md

04 — Multiplayer Network Protocol, Sync and Fairness

### Guiding principle

Input is a request; server state is the verdict. Players never send `hp=0`, `damage=40`,
`teleportTo`, `winnerId` or arbitrary spawned projectiles. Use Colyseus's native 0.18 fixed-step
input channel for continuous movement when available. Use reliable room messages for discrete
actions. Build a shared validator for message schemas and versioning.

### Messages: client → server

The shapes below are logical contracts. Implement with current Colyseus message semantics (use
library-managed `input` sequence numbers if provided), not a second overlapping bespoke input
transport.

| Type | Fields | Validation / server response |
|---|---|---|
| `READY` | `ready:boolean` | Valid only in lobby/pre-countdown |
| `MOVE_INPUT` | `moveX:number`, `moveY:number`, `seq:number` (or native buffered input handle) | Clamp to [-1,1], normalise, dedupe seq, hold last valid for short interval, zero movement on stale input |
| `DODGE_REQUEST` | `actionId:string`, optional input sequence reference | Check stamina/cooldown/phase/dodge/cast, prevent duplicates |
| `SELECT_JUTSU` | `jutsuId:enum` | Validate 1 of 3 configured IDs, cannot switch mid-sign-sequence |
| `SIGN` | `sign:enum`, `confidence:number`, `eventId:string`, `clientObservedMs:number` | Validate enums, thresholds, plausible cadence, ordered sequence; client time is only an untrusted hint |
| `CANCEL_SIGNS` | no extra data | Reset current partial sequence; no resources spent |
| `REMATCH_VOTE` | `accept:boolean` | Only after FINISHED; both accept to reset |
| `LEAVE` | no extra data | Graceful exit and slot handling |

For Colyseus 0.18 built-in clock, prefer `room.clock.rtt()` and `room.clock.jitter()` for HUD; if
unavailable for an installed version, implement a small request/reply ping every 2 seconds. Do not
run both systems simultaneously.

`SIGN` is a gesture observation, not `CAST_JUTSU` as an immediate damage command. Once the server
accepts the final sign in the selected sequence, the server itself initiates a valid cast. This
resolves ambiguity and prevents an unchecked `CAST_JUTSU` packet from skipping required signs. For
explicit cast-button UI, an optional `CAST_REQUEST` may be allowed only if a server-side complete,
unexpired sequence is already stored; default to auto-cast on completion.

### Messages: server → client

| Type | Fields | Purpose |
|---|---|---|
| `ACTION_REJECTED` | `{actionId?, reason, serverTick}` | Not enough chakra, cooling down, invalid sign, dead, not playing, etc. |
| `SIGN_PROGRESS` | `{playerId, jutsuId, index, required, serverTick}` | Confirm recognised ordered sequence |
| `GAME_EVENT` | `{eventId, tick, type, actorId?, targetId?, data?}` | Cast start/release, shield on/off, dash, projectile hit, damage, KO, timeout |
| `MATCH_RESULT` | `{winnerId?, reason, stats, tick}` | Single authoritative result |
| `ROOM_NOTICE` | `{code, message, countdown?}` | Lobby, disconnect, reconnect, expiry |

Continuously synchronised room state already contains HP/chakra/stamina, position, live
projectiles, cooldown ticks, phase, timer, shield and dodge flags. Do not flood discrete update
messages with full snapshots that duplicate synced Colyseus state. Derive HUD from state; use
transient events for animation/sound and user feedback. Use unique `eventId` to dedupe transient
effects.

### Input frequency and patch rate

- Fixed authoritative simulation: 30 ticks/second.
- Movement input: native fixed-step input at 30 Hz (or around 20–30/s if manual fallback); cap
  input traffic server-side.
- Synced state patches: ~15/s (approximately 66–67 ms). Adjust for API and bandwidth without
  changing simulation rate.
- Camera classifier: process at camera capacity (nominally 20–30 FPS) locally, but only send
  accepted/debounced sign events, not all camera predictions.
- Server time: tick/time derived from the authoritative room clock; network timestamps from client
  are untrusted.

### Time, ping and jitter

`RTT ≈ time reply received − time request sent`; ping is RTT in milliseconds; jitter is variation
of successive RTT observations (e.g. smoothed absolute difference). `one-way latency ≈ RTT/2` is an
approximation, not ground truth. Display rolling ping and jitter (e.g. 10-sample EWMA). Flag >150 ms
RTT or >60 ms jitter in a nonblocking HUD warning. Record no more than necessary.

Colyseus 0.18 exposes a synchronised room clock; use its available APIs to avoid custom wall-clock
synchronisation when possible. All match timeouts, cooldowns and invulnerability windows use server
ticks.

### Prediction, interpolation and reconciliation

- Local movement: predict using identical movement step; reconcile by replaying input
  unacknowledged by server. Prefer Colyseus 0.18's `Predict.reconciler` rather than manual netcode.
- Remote movement: interpolate authoritative state ~100 ms behind server time to hide patch jitter.
  No remote client can change authoritative positions.
- Casting feedback: play local preliminary hand-sign acceptance and wind-up VFX quickly, but final
  cast, chakra consumption, projectile creation and hits wait for server confirmation.
- Correction: if server rejects action, show a brief reason and clear optimistic animation. For
  large position corrections, snap safely; for small discrepancies, smooth correction.
- Hit effects: play one damage number and hit animation per unique server event ID; do not count
  duplicated patches/events twice.

### Latency fairness policy

MVP: server-receive-time authoritative dodge, projectile collision and casting. Attacks have
telegraphed wind-ups; the UI must make it clear when a dodge window is available. This is not
perfectly latency-neutral: with very high ping, reaction may register too late. Test playability
with 30/100/200 ms RTT and communicate limitation.

Follow-up for ranked/competitive play: bounded rewind / lag compensation, ideally using Colyseus
0.18 `allowRewindState` and synchronized clocks, with max 100 ms allowable historical adjustment for
relevant dodge/collision adjudication, capped by measured latency; never accept arbitrary client
backdating. Avoid implementing unverified historical dodge state by extrapolating a client-provided
timestamp. A proper rewind needs server-owned history of positions and dodge state, and a written
simultaneous-impact policy.

### Reconnection

- When network drops, server enters `PAUSED_RECONNECT`, freezes match simulation/timer and starts
  10 real seconds grace measured by server monotonic wall clock (not game ticks).
- Show overlay with `Reconnecting…`, remaining grace, clear room exit option.
- Slot recovery must use framework-provided secure reconnection token/session, not the public join
  code. Broadcast full authoritative state after recovery, clear obsolete predicted input buffer.
- Resumption has 2-second common countdown. A second disconnect from the same player during one
  match is immediate forfeit.
- Dispose idle rooms and revoke invite codes after both participants leave.

### Abuse and validation

- Only accept valid message types, numeric finite values, recognised sign enums, bounded nicknames
  and permitted phase transitions.
- Reject illegal requests (cast during dodge, dodge with insufficient stamina, jutsu while cooldown
  active, repeated action IDs, sign faster than allowed).
- Impose reasonable per-peer traffic quotas (e.g. cap movement inputs ~60/s and discrete sign
  events ~12/s with short bursts), without blocking ordinary 30 Hz input.
- Prevent spoofed player IDs: associate network identity with the connection/session, never trust
  user-supplied player ID.
- Server does not trust confidence scores or timestamps as cryptographic proof of real hand
  gestures. Ranked anti-cheat is separate work.
- Send no video data by default; avoid logging gestures / IPs more than needed for diagnostics and
  abuse prevention.

### Sample logical event flows

- Fireball: `SELECT_JUTSU(fireball)` → `SIGN(TIGER)` → `SIGN(BOAR)` → `SIGN(HORSE)` → server
  accepts sequence / checks resources → `GAME_EVENT(CAST_STARTED)` → 350 ms wind-up → projectile
  spawns → projectile moves and collides → `GAME_EVENT(HIT)` → synced HP/shield adjusts.
- Dodge: key-down Space → `DODGE_REQUEST(actionId)` → server checks cooldown/stamina and locks
  direction → server starts dash and i-frame windows → `GAME_EVENT(DODGE_STARTED)` → projectile may
  cross hit circle, consumes projectile with zero damage if in window → server ends dash.
- Regen: no client message. Every playing tick server checks `lastHpDamageTick` and applies HP regen
  after six seconds, while other resources regen as allowed; Colyseus patches updated bars.

---

## FILE: 05_HANDSIGN_RECOGNITION.md

05 — Hand-Sign Recognition and Jutsu Input Pipeline

### Critical distinction

Hand landmarks are not named hand-sign classifications. MediaPipe's hand-landmarker returns hand
coordinates and handedness, not a reliable Tiger/Boar/Horse/Rat/Bird/Snake/Ram jutsu classifier. To
use real webcam sign inputs, the project needs a user-provided trained classifier, or explicit
heuristic rules that have been evaluated for these sign labels. Until then, mock mode is required
and must be visibly labelled.

### Architecture

```text
webcam frame (client only)
  → hand tracker / landmarks (MediaPipe or existing model)
  → classifier adapter predicts {sign, confidence}
  → temporal filter / hold detection / release detection
  → local sign-sequence UI progress (optimistic)
  → SIGN event {label, confidence, uniqueId, observedMs}
  → server validates order / cadence / cooldown / resources
  → server schedules cast
  → shared game state + event VFX
```

No webcam frames transmitted or stored by default; preview local only. Webcam recognition should
not block Phaser rendering: throttle inference to available compute and/or move to worker when
supported; close camera tracks on exit.

### Interfaces (adapt to existing model)

```ts
export type HandSign = 'TIGER' | 'BOAR' | 'HORSE' |
                       'RAT' | 'BIRD' | 'SNAKE' | 'RAM' |
                       'NONE';

export type SignPrediction = {
  sign: HandSign;
  confidence: number;          // 0..1
  timestampMs: number;         // local diagnostic timestamp
  trackingQuality?: number;    // optional 0..1
};

export interface GestureRecognizer {
  readonly name: string;
  start(video: HTMLVideoElement): Promise<void>;
  predictFrame(): Promise<SignPrediction>;
  stop(): Promise<void>;
}
```

Implement these adapters:

- `MockGestureRecognizer`: deterministic keyboard-simulated signs; works without camera and is the
  acceptance-test default.
- `ExistingModelRecognizer`: wrap the user's already existing model if discovered in the repo.
  Document model path, input shape, preprocessing, class-label mapping and output confidence.
- `MediaPipeHandLandmarkerAdapter`: renders/returns landmarks, camera preview, quality. Do not
  silently label hand landmarks as specific jutsu signs. Connect to a trained classifier when
  available.

### Stabilisation algorithm (client)

Starter parameters:

| Config | Initial value |
|---|---|
| Minimum classifier confidence | 0.80 |
| Stable hold time | 150 ms |
| Required release / different valid sign before repeat | Yes |
| Minimum gap between accepted sign events | 120 ms |
| Maximum inter-sign sequence gap | 3000 ms |
| No hands tracked / poor quality | Do not accept a sign; show cue |

Example: maintain a rolling window of predictions, require the same non-NONE label to be dominant
and continuously stable for 150 ms with sufficient confidence; emit exactly one `SIGN` event for
that held pose. Do not emit again until released (`NONE` / other sign) or new transition accepted.
Reset local smoothing after camera switch, blur or reconnect. If signs use two hands, use the
model's actual two-hand labels and enforce the correct configuration.

Server validation: Receive only debounced `SIGN`s. Check known label, legal phase, correct selected
jutsu and expected sign index. Apply a server-side minimum 120 ms accepted event gap, maximum 3000
ms inter-sign gap, per-peer rate limits and unique event ID deduplication. Never count a
client-supplied duration or confidence as proof it really held the sign. Client visual progression
may run ahead optimistically; authoritative progression is what triggers the cast.

### Input controls and mock mode

- `1`, `2`, `3` select Fireball, Lightning Spear, Water Shield respectively.
- `WASD` movement; `Space` dodge; `Escape` opens help/menu; `Backspace` cancels current sign
  sequence when chat/text input does not have focus.
- Mock hand signs: `Q=TIGER`, `E=BOAR`, `R=HORSE`, `T=RAT`, `Y=BIRD`, `U=SNAKE`, `I=RAM`. These keys
  emit through the exact same `SIGN` pipeline as the real adapter; enforce server pacing/sequence
  rules. The UI must show a visible "MOCK HAND SIGNS" label.
- For automated tests, expose an internal helper that generates sign events with valid timing
  through the real network protocol rather than bypassing server checks.
- In an actual webcam production mode, do not let mock mode silently auto-enable just because
  classification is failing. Show transparent instructions and a selectable fallback only in
  permitted casual/testing modes.

### Sign sequence behavior

- UI displays current selected jutsu and icons/names of required signs, with recognised progress
  highlighted.
- Wrong sign: server resets sequence and emits feedback; no chakra consumed.
- More than three seconds between accepted signs: reset sequence; send timeout cue.
- If jutsu switched before any accepted sign, new sequence starts; once started, selection is locked
  until explicit cancel or completion.
- Full valid sequence triggers a server-authoritative cast attempt automatically (no extra click
  required).
- After success or rejected cast attempt, progress resets and UI shows next action/cooldown or
  resource reason.

### Camera usability and privacy

- User explicitly enables webcam through browser permission; preview stays local and is optionally
  mirrored.
- Display permission denied, no device, tracking low quality and classifier missing states
  distinctly.
- Include FPS / inference latency / confidence debug HUD toggle, default off.
- Accessibility: labelled keys in mock mode, high-contrast sign progress, never rely on colour
  alone.
- Do not collect raw image frames, landmarks, biometric identity or model logs on the server in MVP.

### Definition of done

Two players can use mock mode to cast all three jutsus via correct sign order. The camera preview
and landmark adapter work where supported; a real classifier only claims support for named signs
when a trained model with those labels has been located and connected. The recogniser can be
swapped without changing combat logic.

---

## FILE: 06_UI_AND_UX.md

06 — Screens, HUD, Controls and Visual Feedback

### Presentation goals

Fighting-game atmosphere with readable state and responsiveness. Keep graphics simple and functional
rather than blocking implementation on copyrighted assets. Use original placeholder shinobi
silhouettes/shapes and simple particles; no official Naruto logos, music or ripped assets. All
important state must be understandable in under a second.

### Screens

1. Home: Game title, nickname field, `Create Duel` and `Join Duel` (room code input). Input mode
   chooser: `Mock hand signs` (always available) vs `Webcam hand signs` (available only if
   recogniser is configured); show camera permission help. Compact controls explanation and note
   that webcam images stay on device.
2. Room lobby: Invite code with copy button and share link. Two player cards `Player 1` and
   `Player 2` with connected/ready indicators. `Ready` / `Unready`, `Leave`, microphone not
   required; camera preview and optional tracking confidence status. Countdown overlay appears only
   when both are ready. Closing lobby resets readiness appropriately.
3. Battle. Desktop conceptual layout (responsive to narrower screens):

```text
+------------------------------------------------------------+
|  YOU  HP [██████████] 100    02:59  OPPONENT HP [██████░░] |
|       CHAKRA [██████░░]             CHAKRA [████████░░]   |
|       STAMINA[████████]              STAMINA[██████████] |
|                                         ping 42ms • jitter 8ms|
| +--------------------------------------------------------+ |
| |                                                        | |
| |    (P1)             TOP-DOWN ARENA           (P2)      | |
| |         fireball →       shield / dash effects          | |
| |                                                        | |
| +--------------------------------------------------------+ |
| [Camera preview]    Jutsu 1 Fireball [ready]               |
| [Confidence/        TIGER ✓ → BOAR ✓ → HORSE ○             |
|  gesture status]    [1 Fireball] [2 Lightning] [3 Shield]   |
|                    Space Dodge [ready]     Esc Help         |
+------------------------------------------------------------+
```

- HP: distinct red bar + numeric `current / 100`; recent incoming damage number floats above
  character.
- Chakra: blue/cyan bar + numeric; flashes briefly if cast rejected for insufficient chakra.
- Stamina: yellow/amber bar + number; dodge cost visibly drains it; regenerating glow subtle.
- Shield: blue ring around character and shield-capacity mini-bar / icon.
- Dodge: dash trail; brief visible i-frame cue; cooldown spinner near Space indicator; don't imply
  invulnerability beyond actual window.
- Jutsu: selected slot highlight, icon/name/cooldown seconds, ordered sign labels, current progress,
  cast wind-up animation.
- Connection: RTT + jitter text; weak-connection warning above threshold; disconnected/reconnecting
  overlay.
- Match: countdown, `GO`, time remaining, KO/result overlay, rematch and leave.
- Camera: small local preview (optional hide); label `Webcam` vs `Mock`, recognition confidence
  only when model actually returns a named sign.

4. Results: Victory/Defeat/Draw, end reason (KO, timeout, forfeit), elapsed match time and simple
   match stats: total damage, casts by jutsu, successful dodges, remaining health, shields absorbed.
   Buttons `Rematch` (requires both votes) and `Leave`.

### Animation and client reconciliation

- Local movement may render immediately via prediction; remote movement interpolates using
  authoritative snapshots.
- Projectile VFX spawned on server's cast release event; visually interpolate projectiles, never
  decide hit client-side.
- For client-optimistic sign progress, show tentative highlighted sign until authoritative sign
  progress arrives; on mismatch, animate reset rather than silently changing.
- Server event IDs prevent duplicate explosions/hit numbers after reconnect or patch retransmission.
- Hit flashes, shake, particles and sound cues must not hide HUD clarity. Add mute and low-motion
  preferences if feasible.

### Controls

| Input | Action |
|---|---|
| W / A / S / D | Move up / left / down / right |
| Space | Dodge (dash along movement direction, or away from opponent if idle) |
| 1 / 2 / 3 | Select Fireball / Lightning Spear / Water Shield |
| Q / E / R / T / Y / U / I | Mock TIGER / BOAR / HORSE / RAT / BIRD / SNAKE / RAM |
| Backspace | Cancel partial hand-sign sequence (only when not typing) |
| Escape | Toggle instructions/help overlay |

No text field should accidentally activate gameplay keybinds. UI should show active input mode
clearly. If camera sign mode is selected, keyboard movement/dodge still work in MVP; users can
choose to shift hands between camera and keyboard. A future hands-free dodge input is out of initial
scope.

### Errors / edge cases

Room full, invalid invite code, opponent left, failed websocket, server restart, permission denied,
camera unplugged, recogniser missing, unrecognised sign, insufficient chakra, insufficient stamina,
cooldown not ready, paused match and rematch pending. Show exact reason and safe next action; do not
auto-switch to a less trusted input mode invisibly. Responsively resize the arena canvas
maintaining the arena aspect ratio; HUD should remain usable on a typical laptop display, avoiding
offscreen buttons.

---

## FILE: 07_IMPLEMENTATION_AND_TESTING.md

07 — Agent Implementation Plan, Quality Gates and Security

### Delivery philosophy

Build a functioning vertical slice after each phase. Do not start with a huge implementation that
only compiles at the end. The most important deliverable is an executable 1v1 duel in two
independent browser tabs.

### Phase 0 — Audit, bootstrap and tooling

- Inspect existing repo and any gesture-recognition code, preserve prior work.
- If empty, create pnpm monorepo and Vite React TS web app + Colyseus 0.18-compatible server +
  shared package.
- Set strict types, formatter, lint, unit tests, `.env.example`, readme and `pnpm dev`.
- Implement a minimal arena scene with two distinct placeholder avatars.
- Gate: install, dev, build and typecheck work; user can open the web UI.

### Phase 1 — Two-client room and authoritative movement

- Create room/join code flow, two slots max, ready flags, countdown and enter PLAYING.
- Connect two tabs through Colyseus and render both players in one arena.
- Server applies directional movement with normalized vector, bounds and body overlap.
- Wire predicted local movement and interpolated remote movement using supported Colyseus netcode
  APIs (or a documented manual fallback if adapting an older existing implementation).
- Keep all state in server room; show disconnect status.
- Gate: Two browser contexts see each other move consistently; third player rejected; cannot move
  during countdown.

### Phase 2 — Combat resources, dodge, attacks and result

- Add HP, chakra and stamina; apply precise regen and pause rules from `02_GAMEPLAY_RULES.md`.
- Add Space dodge with stamina cost, 1.5-second cooldown, 180 ms movement, 30–150 ms i-frames.
- Add three jutsus, casting windows, projectiles, hit/shield resolution, cooldowns.
- Provide temporary server-side debug cast commands or mock sign pipeline for testing. Never
  implement client-supplied damage.
- Add KO, 180-second timer, draw/timeout, match stats and results.
- Gate: A real networked 1v1 match can finish with correct HP and winner. Dodge avoids damage only
  in exact i-frame window; resources regenerate on server.

### Phase 3 — Hand signs

- Add shared hand-sign IDs and selected jutsu sequence validator on the server.
- Add mock keyboard sign adapter (Q/E/R/T/Y/U/I) through the same sign network path.
- Connect UI progress, auto-cast on final sign, wrong sign/timeout feedback.
- Add local camera preview, adapter interface and optional existing model / MediaPipe landmarks. Do
  not hallucinate that MediaPipe knows named signs.
- Test wrong order, too-fast sign spam, low resources, switching mid-sequence and duplicate sign
  events.
- Gate: Two players can each cast all three jutsus using mock signs. Webcam adapter works if a real
  semantic classifier is available, otherwise it is visibly not yet capable of sign recognition.

### Phase 4 — Robust multiplayer / polish

- Add reconnect grace, paused match semantics, full resync, rematch vote and cleanup.
- Ping/jitter display and warnings, camera diagnostics, compact HUD, hit animation and
  rejected-action feedback.
- Event deduplication, sequence/rate validation, action log, bad-packet tests.
- Add integration tests for two clients and Playwright e2e for create/join/play/finish.
- Test with artificial 30/100/200 ms network RTT and variable jitter, check movement smoothness and
  attack fairness caveats.
- Gate: Automated suite and manual acceptance checks below pass, and no dead UI controls remain.

### Phase 5 — Optional post-MVP

Persist users, match history and ELO-style ranking in PostgreSQL. Matchmaking by skill / region,
queue timeouts and post-match stats. Ranked anti-cheat, audited camera/gesture evidence if users
consent, no default camera uploads. Lag-compensated collision/dodge adjudication with trustworthy
bounded server rewind, replay logs and spectator mode. Additional hand signs/jutsus, status effects,
parry, cosmetic unlocks and mobile-friendly controls. Do not treat Phase 5 as a prerequisite for
delivering the runnable MVP.

### Test specification (minimum)

| Test ID | Scenario | Expected |
|---|---|---|
| U-01 | Normalised (1,1) movement | Speed equals straight movement |
| U-02 | Walk/dash into wall | Position remains inside arena |
| U-03 | Player collision | No overlap within 44 units combined radius |
| U-04 | HP 75; 5.9 sec since HP damage | No HP regen |
| U-05 | HP 75; after 6 sec since HP damage | +2 HP/s, max 100 |
| U-06 | Chakra 90, stamina 90, 1 s PLAYING | Chakra 97, stamina 100 (if not dodging) |
| U-07 | Dodge with 34 stamina | Rejected, no movement/cost/cooldown |
| U-08 | Dodge with 70 stamina | 35 immediate, cooldown 1500ms |
| U-09 | Projectile intersects player during i-frames | 0 HP/shield damage; projectile consumed |
| U-10 | Projectile intersects just outside i-frames | Normal shield/HP damage |
| U-11 | Shield 15; Fireball 28 | Shield 0; HP decreases by 13 |
| U-12 | Correct Tiger→Boar→Horse sequence | Fireball cast begins if valid |
| U-13 | Wrong / too-fast / duplicate sign | No illicit progress/cast |
| U-14 | Fireball with 20 chakra | Rejected, 0 chakra consumed |
| U-15 | Fireball immediately recast | Cooldown rejection |
| U-16 | Projectiles at fast speed | Swept collision detects crossing |
| U-17 | Both players hit 0 HP in one tick | Draw |
| U-18 | 180 s timeout with HP 80 vs 60 | Higher HP wins |
| U-19 | Third player joins full room | Rejected |
| U-20 | Client submits false health/damage/teleport | Ignored / rejected, state unchanged |
| U-21 | Client disconnects 8 sec then reconnects | Match restored after resume countdown |
| U-22 | Disconnect persists >10 sec | Opponent wins by forfeit |
| U-23 | Repeat disconnect same match | Immediate forfeit |
| U-24 | Both rematch | Fresh player stats, cooldowns, projectiles |
| U-25 | Solo room never starts | Remains waiting |
| U-26 | Sign classifier unavailable | Mock works, UI accurately says unavailable |
| U-27 | Two browser sessions | Same authoritative HP/phase/results |
| U-28 | Repeated event packet ID | No duplicate cast/damage/VFX |
| U-29 | Stale / invalid movement input | Zero/clamp/reject; no speed hack |
| U-30 | Text input focused, press action keys | UI text editing, not gameplay action |

### Browser E2E tests

Use Playwright with two independent browser contexts (separate identities/local storage), open two
pages, create a room, join, ready both, wait countdown, move, cast through mock signs with valid
event pacing, dodge, finish match and verify both show same result. Expose deterministic test
configuration / faster match clock only through a clearly labelled test environment, never
unguarded in production.

### Observability

Client debug panel (behind toggle): camera FPS, recognition latency, current sign/confidence if a
classifier exists, render FPS, current server tick, last processed input, ping RTT, jitter, recent
corrective snap magnitude. Server logs: room created/started/ended, authoritative action rejections
and reasons, tick processing time, message counts, disconnections/rejoins. Do not log raw images or
passwords/tokens; avoid persisting individual camera/landmark data.

### Security and privacy checklist

- Use HTTPS/WSS in deployment and request camera permission only after user gesture.
- Validate incoming payload type/range/enum, nicknames and room codes; rate-limit sign and action
  spam; identify player from authenticated connection, never packet field.
- No trust of local gesture correctness, cast timestamps, positions, HP, chakra or shield; all
  effects calculated on server.
- Keep any recovery token private; public invite code never grants takeover.
- Don't upload camera/video or raw landmarks; ensure tracks stop after leaving match.
- Resource bounds, cooldown and i-frame checks must happen in a single authoritative simulation loop
  to avoid race conditions.
- Garbage collect projectiles/expired shields and dispose inactive rooms so resources don't grow
  forever.

### Final acceptance steps for the coding CLI

1. Install dependencies, run lint/typecheck/unit/integration tests, build web and server. Capture
   actual pass/fail counts.
2. Run server and web locally, open two independent browser contexts, play through a demonstrable
   match in mock sign mode; screenshot or record local logs if test tooling supports it.
3. Show run commands and test commands in project README.
4. Write `IMPLEMENTATION_STATUS.md` with working, mocked, deferred, known issues, and specific
   validation results.
5. Never say the webcam recognises jutsu signs unless a real model is actually integrated and
   tested.

---

## FILE: BUILD_PROMPT.md

Master Build Prompt for Claude Code / Codex / Coding CLI

You are my lead full-stack game engineer. Implement the Hand-Sign Jutsu Duel as a working online 1v1
browser game in this repository. First read, in full, all the files above before writing code.

Goal: Two people in separate browsers create/join a private match and actually fight with WASD
movement, Space dodge (stamina + i-frames), a health bar that regens after 6 seconds without damage,
chakra/stamina regen, three jutsus cast by ordered hand signs, real projectiles, a shield,
180-second match timer, and server-authoritative winner. Build functional UI and correct networking,
not just mock screens.

Stack default: React + TypeScript + Vite + Phaser (client), Node + TypeScript + Colyseus
0.18-compatible server (exactly two players per room), shared deterministic game logic in a pnpm
monorepo. If this repository already has a viable different stack, audit and reuse it. Do not
overwrite prior work. Follow installed framework APIs and official docs rather than hallucinating
function signatures.

Hand signs: Use the existing trained hand-sign model if it exists in this repository. Otherwise
implement a clean `GestureRecognizer` interface, a real local webcam preview and MediaPipe
hand-landmark adapter, and a clearly labelled keyboard mock sign mode (`Q/E/R/T/Y/U/I`) that uses the
same server-side sign validation and cast pipeline. Do not claim that landmarks alone can recognise
the seven named signs.

Build in vertical slices and verify after each:

- Stage A: Repository/monorepo setup, client screen, arena, backend.
- Stage B: Create/join two-player room, ready, server countdown, player movement/state sync.
- Stage C: HP/chakra/stamina, regen, dodges, 3 jutsus, projectiles/shield, timeout/KO results.
- Stage D: Server-validated hand-sign sequence, mock sign keys, optional webcam adapter.
- Stage E: Prediction/interpolation, ping/jitter, reconnect/forfeit, UI polish, tests and docs.

Non-negotiable rules: State owned by server; 30 Hz simulation; ~15 Hz state patches; 100 starting
HP/chakra/stamina; HP regen 2/s after 6 s since HP damage; chakra 7/s; stamina 20/s except while
dashing; dodge cost 35, cooldown 1500 ms, dash 150 units / 180 ms, i-frames 30–150 ms; 3 configured
jutsus with exact costs/damage/timing per gameplay spec. Match starts after shared countdown, lasts
180 s, ends by KO/time/disconnect and never permits more than 2 participants. Client never sets its
own health or damage. Camera/video remains local.

Implementation expectations: Use TypeScript strict, shared config/types, real Colyseus room state
and message validation, stable action IDs/sequence numbers, pure and testable physics/combat
functions, no magic duplicate constants. Implement an actual working game scene and HUD (HP, chakra,
stamina, shield, selected jutsu/sign progression, dodge/cooldowns, timer, ping/jitter,
disconnect/KO/rematch). Make it possible to test in two tabs with no webcam or database.

Check before finishing: Run install, typecheck, lint, unit tests, integration/e2e if available, and
both builds. Manually or via Playwright validate a complete two-player mock-sign match. Fix failures,
don't just describe what should be done. Create or update project README run commands,
`.env.example`, `IMPLEMENTATION_STATUS.md` (working/mock/deferred/known issues), and `DECISIONS.md`
for deviations.

When a requirement is difficult: Implement the simplest correct fully working version first, clearly
record what is not yet implemented, and continue. Do not leave fake controls, claim unverified
recognition accuracy, or replace a real server with local-only battle logic. Keep code runnable after
each stage.
