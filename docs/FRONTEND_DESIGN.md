# Jutsu Duel: Front-end Design

Status: approved by the owner on 2026-11-11 with one addition, a light theme (section 10).
Product rules and architecture live in `docs/DESIGN.md`; this document covers how the game
looks, reads and moves.

If Claude Design exports or links are provided later, they override anything here.

---

## 1. Brief, in one paragraph

A desktop browser game played with your hands in front of a webcam. The player is a fan of
ninja-duel anime or a gamer curious about gesture control, and the page is also a portfolio piece
that recruiters and developers will open cold. The interface has one job above all others: during
a fight the player is looking at their own hands, so the HUD must be readable from the corner of
the eye. Everything else (menu, book, history, settings) should feel like it belongs to the same
quiet, confident world and get out of the way.

---

## 2. Design plan

### 2.1 Direction: ink, paper and seals

The world of the game is hand signs, scrolls and stamped seals. The direction borrows three
things from that world and nothing else:

- **Indigo ink as the ground.** The whole interface sits on a deep indigo (the colour of
  traditional indigo-dyed cloth), perceptibly blue rather than black, so video panels and warm
  element colours stand off it.
- **Paper as the action colour.** Text and primary actions are paper-white on ink. There is no
  single "brand accent"; the five element colours carry all the chroma and only ever mean an
  element.
- **The seal as the one ornament.** Every circular token in the interface is a seal: element
  badges, sign tiles in a trail, the projectile in flight, the Substitution cooldown, the sign the
  camera currently sees. One device, used consistently, is the memorable thing. Around it the
  interface is flat: no drop shadows, no gradients, no glows, no skewed plates.

### 2.2 Palette

| Token | Hex | Use |
|---|---|---|
| `--ink-950` | `#0C1627` | Battle stage backdrop, dialog scrim |
| `--ink-900` | `#111F36` | Page background |
| `--ink-800` | `#182A47` | Raised surface (panels, inputs, seals) |
| `--ink-700` | `#22365A` | Default border, hover surface, HP track |
| `--ink-600` | `#31487A` | Strong border, disabled fill |
| `--ink-400` | `#7D8FB3` | Muted text, placeholders (5.1:1 on `--ink-900`) |
| `--ink-200` | `#C5CEE0` | Secondary text |
| `--paper` | `#F4EFE4` | Primary text, primary buttons, focus ring, HP fill |
| `--paper-dim` | `#E2DBCB` | Primary button hover |
| `--fire` | `#FF5A3C` | Fire (5.3:1 on `--ink-900`) |
| `--wind` | `#7ED9A3` | Wind |
| `--lightning` | `#F5E663` | Lightning |
| `--earth` | `#C98A4B` | Earth (5.7:1 on `--ink-900`) |
| `--water` | `#5EB8F5` | Water |
| `--substitution` | `#B9A7E8` | Substitution (non-elemental) |
| `--danger` | `#FF6B8A` | Errors, damage ghost, low HP. A rose, so it never reads as Fire. |
| `--ok` | `#8BE0B0` | Success states (camera ready, saved) |
| `--warn` | `#F5C663` | Warnings (soft banner, degraded detection) |

Element colours are spaced by hue and by lightness so Fire/Earth and Earth/Lightning stay
distinguishable; every element also always appears with its glyph and name, never colour alone.
All text colours above meet WCAG AA on the surfaces they are used on. This table is the dark
theme; the light theme's values and the semantic tokens that map between them are in section 3.

### 2.3 Typography

Two families, clearly distinct, both open licensed and self-hosted via `@fontsource`:

- **Display: Yuji Syuku.** A brush-calligraphy face with Latin glyphs. Used only where the game
  speaks: the landing headline, page titles, jutsu names, element names, the countdown and the
  result word. It is the voice of the world and is never used for UI chrome or body copy.
  Fallback stack: `'Yuji Syuku', 'Hiragino Mincho ProN', Georgia, serif`.
- **Text: Zen Kaku Gothic New.** A clean Japanese gothic with a slightly wide, calm Latin. Used
  for everything else: body, labels, buttons, tables, HUD numbers. Weights 400, 500, 700.
  Fallback stack: `'Zen Kaku Gothic New', 'Hiragino Sans', 'Segoe UI', system-ui, sans-serif`.

Scale (major third, base 16 px):

| Token | Size / line-height | Family | Use |
|---|---|---|---|
| `--text-display-xl` | 76 / 1.05 | Yuji Syuku | Landing headline |
| `--text-display-lg` | 61 / 1.1 | Yuji Syuku | Countdown digits, result word, "Fight" |
| `--text-display-md` | 49 / 1.1 | Yuji Syuku | Page titles |
| `--text-display-sm` | 31 / 1.2 | Yuji Syuku | Jutsu and element names in lists, menu entries |
| `--text-heading` | 25 / 1.25 | Zen Kaku 700 | Section headings |
| `--text-lead` | 20 / 1.4 | Zen Kaku 400 | Lead paragraphs, dialog titles |
| `--text-body` | 16 / 1.5 | Zen Kaku 400/500 | Body, controls |
| `--text-small` | 13 / 1.45 | Zen Kaku 400/500 | Helper text, table meta |
| `--text-hud-lg` | 31 / 1 | Zen Kaku 700, tabular | HP numbers |
| `--text-hud-md` | 25 / 1 | Zen Kaku 700, tabular | Timer, multipliers |

Rules: sentence case everywhere, including buttons and table headers. No tracked-out capitals,
no labels above content that only restate it, no middle-dot separators (write a sentence or use
a table). Prose measure 65ch maximum. HUD numbers sit in boxes sized for their maximum digit
count so a font without tabular figures still cannot make the layout jitter.

### 2.4 Layout concept

Pages use a centred 1120 px column (1216 px on wide screens) with 32 px side padding, left-aligned
text. The battle stage breaks out to the full viewport width up to 1600 px and is symmetric about
a vertical centre line: everything the player does lives on the left, everything the opponent
does on the right, and information travels toward the middle (HP bars drain toward the centre,
projectiles fly toward the centre and clash there, trails fill toward the centre).

```
Page template                             Battle stage
┌────────────────────────────────┐        ┌───────────────────────────────────────┐
│ top bar: title  · · ·   user   │        │ ████████ 100   1:32   100 ████████    │
│                                │        │ you · Genin             Opponent      │
│  Title in brush                │        ├───────────────────────────────────────┤
│  lead paragraph                │        │ flight strip  (seal)──▶   ◀──(seal)   │
│                                │        ├─────────────────┬────┬────────────────┤
│  content, left aligned         │        │  my camera      │ cd │ opponent panel │
│  max 1120 px                   │        │  + overlay      │seal│ avatar/stream  │
│                                │        ├─────────────────┤    ├────────────────┤
│                                │        │ trail ●●●○○○    │    │   ○○○●● trail  │
└────────────────────────────────┘        └─────────────────┴────┴────────────────┘
```

### 2.5 Principles

1. The seal is the only ornament. If something is not a seal, it is flat.
2. Element colour means element. It is never decorative and never used for buttons or focus.
3. Paper on ink. Actions are light on dark; the most important action on a screen is the only
   solid paper button.
4. Information moves toward the centre of the battle stage.
5. One orchestrated motion per screen at most (the countdown on Battle, the sign wheel on
   Landing); every other motion answers a player's action or an engine event and shows what
   changed.
6. Words are signposts: plain verbs, same name through the whole flow ("Rematch" starts a
   rematch, the countdown follows, nothing is renamed on the way).

### 2.6 Review against the generic default

For a "ninja webcam fighting game" the default output would be: a near-black (`#0B0B0B`) ground
with one neon accent, skewed HUD plates with outer glows, a techno display face such as Orbitron
or Bebas Neue, tracked-out capitals for every label ("ROUND 1"), monospace numbers, and the menu
as a grid of identical rounded cards. Each of those was replaced on purpose:

- Indigo that reads as a colour, not a tinted black.
- No single accent; the element palette and paper actions do the work.
- Brush calligraphy for the game's voice instead of a techno face; a calm Japanese gothic for UI.
- Flat, orthogonal panels; the only emphasis device is the seal.
- Sentence case throughout; HUD numbers in the text family, boxed to fixed widths.
- Home is an index of large brush entries with a contextual preview, not a card grid.

Checked against the common AI-design tells as well: the palette is not cream-plus-terracotta
(paper appears only as text and buttons on indigo; the warm red is semantic Fire, not the accent),
there is no monospace, no eyebrow labels, and no appended arrows on links.

---

## 3. Design tokens

Delivered as CSS custom properties in `src/styles/tokens.css`, consumed through CSS Modules.
Components never use raw hex values and never reference a primitive (`--ink-800`) directly;
they use the semantic tokens, which is what makes the light theme a token swap rather than a
second stylesheet.

### 3.1 Primitives

```css
:root {
  /* ink scale (dark theme ground) */
  --ink-950: #0C1627; --ink-900: #111F36; --ink-800: #182A47; --ink-700: #22365A;
  --ink-600: #31487A; --ink-500: #4A628F; --ink-400: #7D8FB3; --ink-200: #C5CEE0;
  /* paper scale (light theme ground, dark theme actions) */
  --paper-50: #FBF8F2; --paper-100: #F4EFE4; --paper-200: #EAE2D3; --paper-300: #D9CFBB;
  --paper-400: #BFB29A;

  /* type */
  --font-display: 'Yuji Syuku', 'Hiragino Mincho ProN', Georgia, serif;
  --font-text: 'Zen Kaku Gothic New', 'Hiragino Sans', 'Segoe UI', system-ui, sans-serif;
  --text-display-xl: 76px; --text-display-lg: 61px; --text-display-md: 49px; --text-display-sm: 31px;
  --text-heading: 25px; --text-lead: 20px; --text-body: 16px; --text-small: 13px;
  --text-hud-lg: 31px; --text-hud-md: 25px;

  /* space (4 px base) */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px;
  --space-8: 32px; --space-12: 48px; --space-16: 64px; --space-24: 96px;

  /* radius: two tiers encode hierarchy. Rectangles are soft; seals are round. */
  --radius-sm: 4px;    /* inputs, chips, table cells */
  --radius-md: 8px;    /* panels, cards, buttons, video panels */
  --radius-full: 999px;/* seals, HP bar ends, pills */

  /* motion */
  --dur-fast: 120ms; --dur-base: 200ms; --dur-slow: 320ms; --dur-ghost: 600ms;
  --dur-flight: 1500ms;                 /* set from balance.config at runtime */
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-stamp: cubic-bezier(0.6, 0, 0.9, 0.35);   /* fast approach, hard stop */

  /* layers */
  --z-panel: 10; --z-hud: 20; --z-overlay: 30; --z-dialog: 40; --z-toast: 50; --z-notice: 60;

  /* layout */
  --page-max: 1120px; --page-max-wide: 1216px; --stage-max: 1600px; --gutter: 32px;
}
```

### 3.2 Semantic tokens, dark theme (default)

```css
:root, [data-theme='dark'] {
  color-scheme: dark;
  --bg: var(--ink-900);            /* page ground */
  --bg-stage: var(--ink-950);      /* battle stage, dialog scrim base */
  --surface: var(--ink-800);       /* panels, inputs, seals */
  --surface-2: var(--ink-700);     /* hover surface, tracks */
  --border: var(--ink-700);
  --border-strong: var(--ink-600);
  --text: var(--paper-100);
  --text-2: var(--ink-200);
  --text-muted: var(--ink-400);    /* 5.1:1 on --bg */
  --action: var(--paper-100);      /* primary button fill */
  --action-hover: var(--paper-200);
  --action-text: var(--ink-900);
  --focus: var(--paper-100);
  --hp-fill: var(--paper-100);
  --fire: #FF5A3C; --wind: #7ED9A3; --lightning: #F5E663; --earth: #C98A4B; --water: #5EB8F5;
  --substitution: #B9A7E8;
  --danger: #FF6B8A; --ok: #8BE0B0; --warn: #F5C663;
}
```

### 3.3 Semantic tokens, light theme

The light theme is the same world seen in daylight: paper ground, ink text and ink actions.
Element colours get darker, more saturated values so they still pass AA as text on paper.

```css
[data-theme='light'] {
  color-scheme: light;
  --bg: var(--paper-100);
  --bg-stage: var(--paper-200);
  --surface: var(--paper-50);
  --surface-2: var(--paper-200);
  --border: var(--paper-300);
  --border-strong: var(--paper-400);
  --text: var(--ink-900);
  --text-2: var(--ink-700);
  --text-muted: var(--ink-500);    /* 5.3:1 on --bg */
  --action: var(--ink-900);
  --action-hover: var(--ink-700);
  --action-text: var(--paper-100);
  --focus: var(--ink-900);
  --hp-fill: var(--ink-900);
  --fire: #C4341C; --wind: #1E7A4B; --lightning: #7A5F00; --earth: #8A4E1C; --water: #1562A8;
  --substitution: #5B44A8;
  --danger: #B5174E; --ok: #1F7F5C; --warn: #8A5A00;
}
```

| Token | Dark | Light | Contrast as text on `--bg` |
|---|---|---|---|
| `--fire` | `#FF5A3C` | `#C4341C` | 5.3 / 4.8 |
| `--wind` | `#7ED9A3` | `#1E7A4B` | 9.7 / 4.7 |
| `--lightning` | `#F5E663` | `#7A5F00` | 13 / 5.3 |
| `--earth` | `#C98A4B` | `#8A4E1C` | 5.7 / 5.8 |
| `--water` | `#5EB8F5` | `#1562A8` | 7.6 / 5.5 |
| `--substitution` | `#B9A7E8` | `#5B44A8` | 8.6 / 6.5 |

### 3.4 Theme selection

- `<html data-theme="dark|light">` is the only switch. A tiny inline script in `index.html` sets
  it before first paint from the stored setting, falling back to `prefers-color-scheme`, so the
  page never flashes the wrong theme.
- Settings gains an Appearance section: Theme, a segmented control with System, Dark and Light.
  "System" follows the OS and updates live when the OS switches.
- The choice is stored with the other settings (`theme: 'system' | 'dark' | 'light'`, default
  `system`) and cached in `localStorage` so it applies before login and before Supabase answers.
- Element colour is applied through a `data-element` attribute that sets `--element-color`, so a
  single `Seal`, `HpBar` or `JutsuRow` stylesheet works for every element in both themes:

```css
[data-element='fire'] { --element-color: var(--fire); }
[data-element='substitution'] { --element-color: var(--substitution); }
```

- Video panels, the landmark overlay and the sign skeleton references use the semantic text
  tokens, so they read correctly on both grounds. Screenshots for the README are taken in both
  themes.

## 4. Iconography and illustration (all original)

### 4.1 Seal

A circle with a 2 px ring in `--element-color` (or `--ink-400` when neutral), filled
`--ink-800`, glyph in the ring colour. Variants:

| Variant | Look | Used for |
|---|---|---|
| `outline` | Ring + glyph, dark fill | Empty trail slot (dashed ring, `--ink-600`), sign reference, lists |
| `stamped` | Solid `--element-color` fill, glyph in `--ink-950` | A registered sign in a trail, the active sign in Practice |
| `ring` | Outline with a conic progress ring | Substitution cooldown |
| `pulse` | Stamped, scales 1.4 → 1 once | The moment a sign registers or a projectile launches |

Sizes: 24 (compact lists), 32 (trails, rows), 48 (HUD, projectiles), 64 (book entries), 96
(Practice current sign, landing wheel centre).

### 4.2 Element glyphs

Two-stroke ideograms on a 24 px grid, 2 px stroke, round caps:

| Element | Glyph |
|---|---|
| Fire | A single flame tongue: teardrop with one notch on the right |
| Wind | Three staggered horizontal strokes, the middle one longest |
| Lightning | A three-segment bolt |
| Earth | A low trapezoid mound on a ground line |
| Water | Two stacked wave strokes |
| Substitution | Two arcs forming a broken ring (a swap) |

### 4.3 Sign glyphs

Minimal ideograms, one per zodiac sign, same grid and stroke. They are mnemonics, not
illustrations of the hand pose:

| Sign | Glyph |
|---|---|
| Rat | A dot with a long curved tail |
| Ox | A U of horns on a horizontal bar |
| Tiger | Three short diagonal claw strokes |
| Hare | Two tall parallel ears, rounded tops |
| Dragon | An open spiral |
| Snake | An S curve |
| Horse | A horseshoe arc, open at the bottom |
| Ram | Two tight curls (horns) |
| Monkey | A circle with a hooked tail |
| Bird | A wide chevron (wings) |
| Boar | Two short upward tusk crescents |
| Dog | A paw: three dots over an oval |

### 4.4 Hand-pose reference

How to actually form a sign is shown as a **rendered landmark skeleton**: the recorder gains a
"Save as reference" action that stores one canonical sample per sign in
`src/content/sign-references.json`, and the app draws it in the same style as the live overlay
(paper joints, ink-200 bones). This is original, consistent with the battle screen, and shows no
photograph of anyone. Until references are recorded, the Jutsu Book shows the glyph with the
written pose description from the content config.

### 4.5 Landmark overlay

Joints: 4 px dots in `--text` at 85 % alpha. Bones: 2 px lines in `--text-2` at 70 %. Alpha
scales with detection confidence, so an uncertain pose looks faint and a confident one crisp.
No colour tinting by element: the overlay reports tracking quality only.

### 4.6 Bot avatar

A plain oval mask on an ink field with two eye slits, drawn in paper strokes. The three
difficulties add one, two or three short painted strokes across the brow. Shown in the opponent
panel whenever `mediaStream` is null.

---

## 5. Component inventory

Primitives (`src/components/`), each with its states:

| Component | Variants / props | States |
|---|---|---|
| `Button` | `primary` (paper fill), `secondary` (ink-800 fill, ink-600 border), `ghost` (text only), `danger` (ink-800 fill, danger text); sizes `md`, `lg`; `icon` slot | default, hover, active, focus-visible, disabled, loading (spinner replaces label, width preserved) |
| `IconButton` | 32 / 40 px square, ghost or secondary | same as Button |
| `TextField` | label, helper, error, `type`, prefix/suffix slot | default, focus, error, disabled, read-only |
| `PasswordField` | TextField with show/hide toggle | as TextField |
| `Select` | native `select` styled | default, focus, disabled, empty options ("No cameras found") |
| `Slider` | min/max/step, value readout, optional live meter underneath | default, focus, disabled |
| `Toggle` | switch with label | on, off, focus, disabled |
| `SegmentedControl` | 2–3 options | selected, focus, disabled option |
| `KeyBindingInput` | shows current key, "Press a key" capture mode | idle, listening, conflict (danger text names the other sign) |
| `Seal` | `element`, `sign`, `size`, `variant` (4.1) | as variants; `aria-label` from content config |
| `SignTile` | Seal 32 in a trail slot | empty (dashed), filled (stamped, pulse once), fading (buffer timing out: ring dims over last 500 ms) |
| `SignTrail` | 6 slots, `direction: 'ltr' \| 'rtl'`, optional candidate label | empty, partial, complete (flashes once then clears) |
| `HpBar` | `side: 'left' \| 'right'`, value, max | full, draining (ghost segment in danger catches up over `--dur-ghost`), low (≤ 25 %: fill becomes danger), zero |
| `Timer` | seconds remaining | running, last 10 s (danger text), stopped |
| `FlightStrip` | list of projectiles with cast/land times | empty, projectile in flight, clash burst, dodge puff |
| `CooldownSeal` | ready-at timestamp | ready, cooling (conic ring), just-ready pulse (once) |
| `VideoPanel` | `stream`, `mirror`, `overlay` (landmarks), `label`, `avatar` | loading (skeleton with spinner), live, no-stream (avatar), error (message with action), hit flash (danger border 200 ms), dodge stamp |
| `DetectionReadout` | current sign seal 96, name, confidence meter | none ("No sign"), detecting (below threshold: faint), confident (stamped) |
| `JutsuRow` | name, element, sequence, damage, beats/loses sentence | default, focused (keyboard), highlighted (in Practice) |
| `SignReference` | glyph seal 64, name, skeleton or description, key binding | with reference, without reference |
| `DifficultyOption` | name, one-line description, mask avatar | default, selected, hover, focus |
| `StatList` | label/value rows | default |
| `Table` | header, rows, `Load more` | loading rows (skeleton), empty, error |
| `Toast` | message, `tone` | info, ok, danger; auto-dismiss 4 s; focusable close |
| `Dialog` | title, body, actions | open, closing; focus trapped; ESC closes unless destructive |
| `Banner` | message, action, dismissible | warn, danger |
| `EmptyState` | title, one line, action | |
| `ErrorState` | title, what happened, how to fix, action | |
| `Spinner`, `Skeleton` | sizes | |
| `TopBar` | title, nav links, user menu | default, battle mode (hidden) |
| `DesktopOnlyNotice` | full page | |
| `CountdownOverlay` | 3, 2, 1, fight | |
| `ResultWord` | win / loss / draw word in brush | |
| `SignWheel` | 12 seals in a ring, centre skeleton | animating, static (reduced motion) |

Every interactive component shows the paper focus ring on `:focus-visible` and respects
`prefers-reduced-motion`.

---

## 6. Screens

Each screen lists its layout at 1280 px, then its states. Copy shown is proposed final copy;
themed words come from the content config.

### 6.1 Landing (`/`)

```
┌───────────────────────────────────────────────────────────────────────┐
│ Jutsu Duel                                         Log in   Sign up   │
│                                                                       │
│  Your hands are                        ╭───── sign wheel ─────╮       │
│  the controller.           (brush 76)  │  12 seals in a ring, │       │
│                                        │  skeleton of the     │       │
│  Perform hand signs on your webcam     │  highlighted sign in │       │
│  to cast jutsu in real-time duels.     │  the centre, cycling │       │
│  Play the bot now. Fight friends       │  every 1.6 s         │       │
│  live soon.                            ╰──────────────────────╯       │
│  [ Create account ]   Log in                                          │
├───────────────────────────────────────────────────────────────────────┤
│  How a duel works                                                     │
│  (seal) Weave a sequence   ──▶  (seal) It flies for 1.5 s  ──▶        │
│  (seal) Read their trail and clash, or substitute                     │
├───────────────────────────────────────────────────────────────────────┤
│  Five elements, one cycle            pentagon of element seals        │
│  Fire beats Wind beats Lightning beats Earth beats Water beats Fire.  │
├───────────────────────────────────────────────────────────────────────┤
│  Your camera stays on your device. Nothing is uploaded.    Desktop    │
│  Chrome or Edge recommended.                              1280 px+    │
└───────────────────────────────────────────────────────────────────────┘
```

The "How a duel works" row is a sequence in the game, so an arrow flow is honest here. The sign
wheel is the one animated element on the page: the highlighted seal stamps, the centre skeleton
cross-fades (200 ms). Reduced motion: static on Tiger.

States: logged-in visitors are redirected to Home. No loading or error states beyond fonts.

### 6.2 Log in (`/login`) and Sign up (`/signup`)

Centred 400 px column on the page ground, title in brush 49, one form, one primary button.

- Log in: email, password, "Log in" (primary), "New here? Create an account". Errors inline
  under the field or as a form-level danger line ("Email or password is incorrect.").
- Sign up: username (helper: "3 to 20 characters, lower-case letters, numbers, underscore";
  availability checked 400 ms after typing stops, with "Available" in ok or "Taken" in danger),
  email, password (minimum 8), "Create account". After submit, if confirmation is required:
  a confirmation state replaces the form ("Check your inbox. We sent a confirmation link to
  you@example.com.") with a "Back to log in" ghost button.

States: idle, submitting (button loading, fields disabled), field error, server error, offline
("You're offline. Try again when you're connected.").

### 6.3 Home (`/home`)

```
┌───────────────────────────────────────────────────────────────────────┐
│ Jutsu Duel                                              sakura_fan ▾  │
│                                                                       │
│  Play vs Bot            (brush 31)   ┃  preview panel for the         │
│  Practice                            ┃  hovered/focused entry:        │
│  Jutsu Book                          ┃  Play vs Bot → last result,    │
│  Match History                       ┃    record, "Continue as Jonin" │
│  Settings                            ┃  Practice → last practised     │
│  Online 1v1   (seal) Coming soon     ┃  History → wins/losses tally   │
│                                      ┃  Settings → input mode, camera │
└───────────────────────────────────────────────────────────────────────┘
```

An index of six brush entries, left aligned, 56 px apart; the focused entry gets a solid paper
seal marker to its left. The right panel updates on hover and keyboard focus. Online 1v1 is
rendered at 50 % with a small `--ink-400` seal reading "Coming soon" and is not focusable as a
link.

States: preview panel loading (skeleton lines), preview error (falls back to a static description
of the entry), no matches yet ("No matches yet. Your first duel starts here.").

### 6.4 Pre-battle (`/play`)

```
┌───────────────────────────────────────────────────────────────────────┐
│  Choose your opponent                                      (brush 49) │
│                                                                       │
│  ( mask ) Genin        ( mask ) Chunin       ( mask ) Jonin           │
│  Weaves slowly and     Reads your trail      Counters your element    │
│  never reads you.      after two signs.      and times the clash.     │
│                                                                       │
│  Input      [ Webcam | Keyboard ]                                     │
│                                                                       │
│  Camera check                       ┌─────────────────────────┐       │
│  ✓ Camera on (Logitech C920)        │ live preview + overlay  │       │
│  ✓ Hand tracking loaded             │                         │       │
│  ○ Hold the Ram sign to confirm     │ (seal) Ram  0.42        │       │
│                                     └─────────────────────────┘       │
│                                           Change camera · in Settings │
│  [ Start battle ]                                                     │
└───────────────────────────────────────────────────────────────────────┘
```

Difficulty options are three selectable rows with the mask avatar, name and one honest sentence
about behaviour. "Start battle" is enabled when a difficulty is selected and either keyboard mode
is on or the three checks pass. The confirmation check asks for a sign (Ram) so the whole
pipeline is proven before the fight.

States:
- Camera requesting: preview skeleton, first check shows a spinner and "Waiting for permission".
- Permission denied: preview replaced by an ErrorState: "Camera access is blocked. Allow the
  camera for this site in your browser's address bar, then reload." Actions: "Reload",
  "Use keyboard instead".
- No camera: "No camera found. Connect one, or play with the keyboard." Action: "Use keyboard
  instead".
- Camera in use: "Another app is using the camera. Close it and try again." Action: "Try again".
- Model loading: second check spinner; failure: "Hand tracking couldn't load. Check your
  connection and try again." Action: "Retry".
- No model file (ML detector unavailable): third check shows a warn line "No recognition model is
  installed yet. Keyboard mode is available." and keyboard mode is preselected.
- Keyboard mode: the camera section collapses to a key map preview (4 × 3 keys with sign glyphs).

### 6.5 Battle (`/play/battle`)

Full-width stage (max 1600 px) on `--ink-950`, top bar hidden. Layout as in 2.4; at 1280 px with
32 px gutters the panels are 544 × 306 px and the centre column 96 px.

Behaviour, top to bottom:

- **HP bars**: 24 px tall, paper fill on `--ink-700` track, drain toward the centre. The HP
  number (31 px tabular, boxed for three digits) sits on the outer side. On damage the fill drops
  immediately and a danger ghost segment shrinks over 600 ms. Below each bar: your username and
  difficulty on the left, the opponent's name on the right.
- **Timer**: centre, 25 px tabular, `m:ss`. Turns danger for the last 10 s.
- **Flight strip**: 56 px tall, full width. A cast creates a 48 px element seal with the jutsu
  name in brush 25 beside it, sliding linearly from the caster's edge to the opposite edge over
  `--dur-flight`, timed from the engine's `castAt` (negative `animation-delay` keeps it in sync
  if mounted late). A clash: both seals snap to the centre, scale 1 → 1.6 while fading over
  300 ms, and the multipliers ("×1.5", "×0.5") appear in each element's colour for 800 ms. A
  dodge: the projectile seal shrinks and fades over 200 ms and a Substitution seal stamps on the
  defender's panel corner.
- **Video panels**: mine on the left, mirrored by setting, with the landmark overlay; a compact
  `DetectionReadout` (seal 48, name, confidence) sits in its bottom-left corner. The opponent
  panel shows the bot mask or, later, the remote stream. On hit the target panel's border flashes
  danger for 200 ms.
- **Centre column**: the `CooldownSeal` (48 px) vertically centred; while cooling, a conic ring
  fills clockwise over 8 s and the glyph dims; when ready it pulses once.
- **Trails**: six 32 px slots under each panel. Mine fills left to right, the opponent's right to
  left. The opener's element colours the filled seals. Under my trail only, the matching jutsu
  name appears once the buffer is unique ("Fireball" after Tiger → Horse). The last 500 ms before
  the 2.5 s buffer timeout, filled seals dim to warn the player.
- **Countdown**: on entry the stage dims; "3", "2", "1" in brush 61 stamp in (scale 1.4 → 1,
  200 ms, `--ease-stamp`) one per second, then the fight word (content config) stamps and fades
  over 400 ms as the engine starts. This is the screen's one orchestrated motion.
- **Pause**: Esc opens a dialog ("Paused": Resume, Forfeit). The controller stops feeding time to
  the engine; the bot pauses with it. Forfeit asks once more inside the same dialog.
- **End**: on KO or time up the result word stamps over the stage for 1.2 s, then the app
  navigates to Results.

States: camera lost mid-match (panel shows ErrorState "Camera disconnected" with "Use keyboard"
which switches the detector live; match continues), detector degraded (readout shows "Tracking
poor" in warn), bot error (should not happen; falls back to forfeit by bot with a toast), low HP
(fill turns danger), reduced motion (projectile shown as a static seal with a thin progress bar,
no flashes, no stamps: elements fade in and out at 120 ms).

### 6.6 Results (`/play/results`)

```
┌───────────────────────────────────────────────────────────────────────┐
│  Victory                   (brush 61)  │  Damage dealt           118  │
│  against Chunin in 0:48                │  Damage taken            64  │
│                                        │  HP left        you 36, bot 0│
│  Jutsus used                           │  Clashes won              2  │
│  (seal) Fireball            ×3         │  Clashes lost             1  │
│  (seal) Water Dragon        ×1         │  Substitutions            1  │
│  (seal) Substitution        ×1         │                              │
│                                        │  Saved to your match history │
│  [ Rematch ]  Change difficulty  Back to menu                         │
└───────────────────────────────────────────────────────────────────────┘
```

States: saving (small spinner line "Saving match"), saved (ok text), save failed ("Couldn't save
this match. It will be retried next time you open the game." in warn), draw and defeat variants
of the result word, accessed without a finished match (redirect to `/play`).

### 6.7 Practice (`/practice`, `/practice/:jutsuId`)

List page: "Practice" title, a line of text, then the 11 jutsus as `JutsuRow`s grouped by element
plus a "Free practice" entry at the top that shows the live readout with no target.

Jutsu page:

```
┌───────────────────────────────────────────────────────────────────────┐
│  Fireball                      (brush 49)   Fire, 3 signs, 12 damage │
│ ┌──────────────────────────────────────┐   Sequence                   │
│ │ camera + overlay (720 × 405)         │   (stamped) Tiger            │
│ │                                      │   (ring)    Horse  ← now     │
│ │                                      │   (outline) Rat              │
│ │  (seal 96) Horse        0.83 ▮▮▮▮▮▯  │                              │
│ └──────────────────────────────────────┘   Time 1.2 s   Best 2.4 s    │
│  Restart    Pick another jutsu              Attempts 4   Completed 3  │
└───────────────────────────────────────────────────────────────────────┘
```

Each registered sign stamps its seal in the list; a wrong sign shakes the current slot 120 ms
(reduced motion: turns danger for 300 ms) and resets per the same buffer rules as battle. On
completion the jutsu name stamps over the video in brush 61 and fades over 800 ms; the sequence
resets after 1.2 s. Stats are per session, not stored.

States: camera states as in Pre-battle (same ErrorState components), keyboard mode (the key for
each sign is shown beside it), buffer timeout (the stamped seals fade back to outline over
300 ms).

### 6.8 Jutsu Book (`/jutsu-book`)

Two sections on one page with an in-page nav: "Jutsus" and "Signs".

Jutsus: five element groups in cycle order, each introduced by the element seal (64), the element
name in brush 31 and one sentence: "Beats Wind. Loses to Water." Inside, two `JutsuRow`s: name
(brush 31), element seal, the sequence as 32 px sign seals with names underneath, damage, and
"Practice" as a ghost button. Substitution closes the list with its own row explaining the
negate rule and the 8 s cooldown. Damage values and timings are read from the balance config so
the book never drifts from the engine.

Signs: a 4 × 3 grid of `SignReference` entries: glyph seal 64, name, the skeleton reference (or
the written pose description if none is recorded yet), and the current key binding.

States: static content; no loading. A sign without a reference shows "Reference not recorded yet"
in muted text (dev builds add a link to the recorder).

### 6.9 Match History (`/history`)

Title, a one-line summary in prose ("14 matches, 9 won."), two filters (Result, Difficulty),
then a table: Date, Opponent, Result, Duration, HP left (you and opponent), Jutsus (first four
seals with counts, then "+2"). 20 rows per page with "Load more".

States: loading (six skeleton rows), empty ("No matches yet. Your first duel starts here." with
"Play vs Bot"), filtered-empty ("No matches match these filters." with "Clear filters"), error
("Couldn't load your matches." with "Try again"), offline banner.

### 6.10 Settings (`/settings`)

Sectioned form, label column 240 px, control column 560 px, auto-saved with a per-section
"Saved" line that appears for 2 s.

- Appearance: Theme as a segmented control with System, Dark and Light. Applies instantly;
  System follows the OS and updates live.
- Input: segmented Webcam / Keyboard.
- Camera: camera select (labels appear after permission; "Allow camera to see names"), "Test
  camera" opens a 320 px live preview, Mirror video toggle, Show landmarks toggle, Detection
  threshold slider (0.50–0.95, step 0.05) with the live confidence meter underneath while the
  preview is open.
- Key bindings: 12 rows, sign seal + name + `KeyBindingInput`; conflicts are refused with the
  message "Already used by Tiger." "Reset to defaults" ghost button.
- Audio: Master, Effects, Music sliders with the note "Sound arrives in a later version; your
  levels are saved now."
- Account: username field with availability check and an explicit "Save username" button; email
  read-only; "Log out" as a secondary button at the end.

States: loading settings (skeleton form), save error (danger line "Couldn't save. Your change is
kept on this device and will retry."), camera errors inside the test preview, username taken,
offline.

### 6.11 404

Brush 49 "This page doesn't exist." one sentence, "Back to home" primary button. Same page
template, centred vertically.

### 6.12 Desktop-only notice

Full-page ink ground, brush 49 "Jutsu Duel needs a desktop", one paragraph ("The game tracks
both hands on a webcam and is designed for screens 1280 px and wider."), and "Copy link" so the
visitor can send the URL to their computer. Shown below 1024 px; from 1024 to 1279 px a
dismissible warn `Banner` reads "Best at 1280 px or wider."

### 6.13 Recorder (`/dev/recorder`, dev only)

Utility layout, not styled for players but using the same tokens: camera preview with overlay on
the left (960 × 540); on the right the label select (12 signs + none), samples per capture,
"Start capture" (3 s countdown, big brush digits over the preview, then a progress count), a
guidance line ("Move and rotate your hands slightly while capturing"), the session table of
per-label counts, "Undo last", "Clear session", "Import", "Export JSON", "Save as reference", and
the live classifier readout when a model is loaded.

---

## 7. Motion specification

| Moment | Motion | Duration / easing | Reduced motion |
|---|---|---|---|
| Countdown and fight word | Stamp: scale 1.4 → 1, opacity 0 → 1 | 200 ms, `--ease-stamp` | Fade 120 ms |
| Sign registers | Seal stamps (fill) + pulse 1.4 → 1 | 160 ms, `--ease-out` | Fill only |
| Projectile in flight | Translate across strip | `--dur-flight`, linear | Static seal + progress bar |
| Clash | Seals meet, scale 1 → 1.6, fade; multipliers appear | 300 ms / 800 ms hold | Multipliers only |
| Hit | Target panel border flashes danger; HP fill drops, ghost shrinks | 200 ms / 600 ms `--ease-out` | Ghost shrink only |
| Dodge | Projectile shrinks and fades; Substitution seal stamps on panel | 200 ms | Fade |
| Cooldown | Conic ring fills clockwise; one pulse when ready | 8 s linear; 200 ms | Ring only |
| Buffer about to time out | Filled seals dim | last 500 ms | Same (opacity only) |
| Hover / focus | Background and border colour | `--dur-fast` | Same |
| Dialog, toast | Fade + 8 px rise | `--dur-base`, `--ease-out` | Fade |
| Landing sign wheel | Highlight advances, centre skeleton cross-fades | every 1.6 s; 200 ms | Static |

Nothing loops indefinitely except the sign wheel on the landing page and the cooldown ring while
cooling. No entrance animations on page sections.

---

## 8. Accessibility

- Every control reachable by keyboard; `:focus-visible` paper ring, 2 px, offset 2 px.
- Element is conveyed by glyph and name as well as colour; seals carry `aria-label`s from the
  content config ("Fire", "Tiger").
- HP, timer and result changes are announced through a polite live region in words
  ("Opponent took 18 damage. 46 HP left."), throttled to one announcement per second.
- Video elements are `muted` and `playsInline`; the overlay canvas is `aria-hidden`.
- Dialogs trap focus, restore it on close, and label themselves.
- Text contrast meets AA on its surface in both themes; large brush headings meet AA for large
  text. Element colours have separate light-theme values for the same reason.
- `prefers-reduced-motion` follows the table in section 7.
- Keyboard mode makes the whole game playable without a camera; key bindings are rebindable.

---

## 9. Implementation notes

- CSS Modules per component plus `src/styles/tokens.css` and `src/styles/global.css` (reset,
  fonts, base type). No utility framework and no component library; the inventory above is small
  enough to own.
- Theme: a `ThemeProvider` owns the `theme` setting, writes `data-theme` on `<html>`, and
  listens to `prefers-color-scheme` while the setting is `system`. An inline script in
  `index.html` applies the cached choice before React loads so there is no flash. Components only
  ever use semantic tokens (`--bg`, `--surface`, `--text`, `--action`, element tokens), never
  the ink or paper primitives.
- Fonts via `@fontsource/yuji-syuku` and `@fontsource/zen-kaku-gothic-new` (400, 500, 700),
  `font-display: swap`, preloaded on the landing and battle routes.
- Element theming through `data-element` and `--element-color`; never per-element class names.
- `--dur-flight` is written on the stage root from `BALANCE.flightMs` so the animation cannot
  disagree with the engine.
- Icons are inline SVG components in `src/components/icons/` with `currentColor` strokes.
- Battle HUD components are pure presentational components fed by the engine snapshot; event
  driven effects (flash, burst, stamp) are triggered through a tiny `useEngineEvent` hook so
  they can later be swapped for a real effects layer without touching layout.
- Screenshots of each screen are taken during the polish pass (v0.6.0) and placed in
  `docs/screenshots/` for the README.

---

## 10. Decisions

Approved by the owner on 2026-11-11:

1. Palette: indigo ground, paper actions, five element colours (2.2).
2. Type: Yuji Syuku for display and Zen Kaku Gothic New for text (2.3).
3. Home as a brush index with a preview panel rather than a card grid (6.3).
4. The flight strip as a full-width band above the video panels, with instant clash at the
   centre (6.5).
5. Hand-pose references as rendered landmark skeletons captured through the recorder (4.4).
6. Two themes instead of one: dark by default, light by system preference or by choice in
   Settings (3.3 and 3.4). The light theme was the owner's addition to the proposal; it is a
   semantic-token swap, not a second design.
