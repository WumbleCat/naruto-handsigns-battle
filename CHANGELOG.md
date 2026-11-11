# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
