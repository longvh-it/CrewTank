# Repository Guidelines

## Project Overview
Crew Tanks: 2D top-down multiplayer tank game in the browser for company team building. 2 teams, 6–8 players; each tank has 1–2 crew (driver = WASD, gunner = mouse; solo tank does both). Built in 12 roadmap steps (`docs/ROADMAP.md`); only step 1 (scaffold) is done — most modules in `docs/ARCHITECTURE.md` are still planned.

Docs are in Vietnamese; reply to the team in Vietnamese. Source of truth: `docs/DESIGN.md` (rules, numbers), `docs/ARCHITECTURE.md` (structure, socket protocol), `docs/ROADMAP.md` (steps, done criteria), `docs/WORKFLOW.md` (git/PR), `CLAUDE.md` (agent rules).

## Architecture & Data Flow
- **Server authoritative.** Client sends only `PlayerInput` (`game:input`, 30/s). Never send positions, HP or hits from the client.
- Server: simulate at `TICK_HZ` (30), broadcast `GameSnapshot` via `game:state` every `SNAPSHOT_EVERY_TICKS`; discrete `game:event` (hit/kill/explode/pickup) sent immediately. Note: docs say "every 2 ticks ≈ 20 Hz" but 30/2 = 15 Hz — resolve before step 3.
- Client renders `INTERP_DELAY_MS` (100 ms) in the past, lerping position and shortest-arc angles (planned `client/src/game/Interpolator.ts`).
- Tick order: inputs (move only from driver seat, aim only from gunner) → move + wall/tank collision → spawn/sub-step bullets (≤ `BULLET_MAX_SUBSTEP` = 8 px) → hits/HP/kills/respawn/pickups → win check → snapshot.
- Typed Socket.IO both sides, generics from `shared/types.ts`:
  - server: `new Server<ClientToServer, ServerToClient>(httpServer)` (`server/index.ts`)
  - client: `type GameSocket = Socket<ServerToClient, ClientToServer>` + `createSocket()` (`client/src/net/socket.ts`, same-origin `io()`)
- Acks use `Ack<T>`: `({ ok: true } & T) | { ok: false; error: string }`.
- Planned: Zod validation of every client payload in `server/validate.ts` (invalid → drop, log in dev), 40 inputs/s per socket limit, Zustand store updated only on HP/score/phase/kill-feed change (React never re-renders per frame), Phaser scene gets socket via constructor (no globals). In-memory state only, no DB.

## Key Directories
- `shared/` — `@crew-tanks/shared`: protocol types, constants, and (planned) pure functions `physics.ts`, `teams.ts`, `map.ts` with tests.
- `server/` — Express + Socket.IO; planned `RoomManager.ts`, `Room.ts`, `Game.ts`, `Stats.ts`, `validate.ts`, `maps/*.json`.
- `client/` — Vite + React; `src/net/`, planned `src/ui/` (Home, Lobby, Hud, Scoreboard), `src/game/` (Phaser), `src/store.ts`, `public/assets/` (Kenney sprites, Tiled maps).
- `.claude/commands/` — `/step <n>` and `/fix <bug>` prompts.

## Development Commands
```bash
pnpm install
pnpm dev         # server :3000 (tsx watch) + client :5173 (Vite, proxies /socket.io incl. ws)
pnpm build       # client only -> client/dist (server serves it if present)
pnpm start       # server via tsx, PORT env overrides 3000
pnpm typecheck   # tsc --noEmit in each package
pnpm test        # vitest run --passWithNoTests
```
No linter/formatter configured. Must pass `pnpm typecheck && pnpm test` before finishing any task.

## Code Conventions & Common Patterns
- TypeScript strict (`noUncheckedIndexedAccess`, `noImplicitOverride`, `isolatedModules`). No `any`, no `@ts-ignore`.
- Contract first: add/change event or payload types in `shared/types.ts`, then code.
- All tunables in `shared/constants.ts` as `UPPER_SNAKE` exports (e.g. `TANK_STATS[crew]`, `BULLET_SPEED`); no magic numbers elsewhere.
- Import shared via subpath exports: `import type { GameSnapshot } from '@crew-tanks/shared/types'`, `import { TICK_HZ } from '@crew-tanks/shared/constants'` (mapped straight to `.ts`, no build step).
- Named exports (`export function App`), PascalCase files for classes/components (`Game.ts`, `BattleScene.ts`), camelCase for modules (`socket.ts`, `physics.ts`).
- Physics and team assignment are pure functions in `shared/` with unit tests.
- Files under ~300 lines. Phaser 3 APIs only (never Phaser 4).
- New dependencies need a stated reason.

## Important Files
- `server/index.ts` — server entry, static `client/dist`.
- `client/src/main.tsx` → `App.tsx` — client entry (StrictMode).
- `shared/types.ts`, `shared/constants.ts` — shared contract.
- `client/vite.config.ts` — dev port + proxy (reads constants).
- `tsconfig.base.json`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml`.

## Runtime/Tooling Preferences
- Node ≥ 20 (CI uses 20), pnpm 12.4.2 (`packageManager`). Not Bun.
- pnpm 12 policy: `allowBuilds: esbuild: true` in `pnpm-workspace.yaml`; packages younger than `minimumReleaseAge` may be rejected — regenerate lockfile if install fails on that.
- Stack fixed: Vite + React 18 + Phaser 3 + Zustand; Express + Socket.IO v4 + Zod; Vitest; Tiled JSON maps; Kenney Topdown Tanks (CC0).

## Testing & QA
- Vitest, config `vitest.config.ts`, globs `shared/**/*.test.ts`, `server/**/*.test.ts`, `client/src/**/*.test.ts`. No tests exist yet.
- Every new pure `shared/` function gets tests (planned: wall/corner/slide/tank collisions, bullet bounce + no tunneling at max speed, `autoBalance` for 2–8 players).
- Bug fix: write a failing reproduction test first.
- Multiplayer manual QA: 2+ browser windows (one incognito), per each step's **Hoàn thành khi**.
- CI runs install (frozen lockfile), typecheck, test on PRs and pushes to `main`; no build in CI.

## Workflow
- Team of several; claim one roadmap step with merged dependencies by writing your GitHub name in **Người nhận** and committing to `main`. One step per person / per session; do only that step.
- Branch `step-NN-ten-buoc`; small PRs, ≥1 reviewer; shared files (`shared/types.ts`, `shared/constants.ts`, `client/src/store.ts`, `server/index.ts`, `CLAUDE.md`, `docs/*`) only when the step needs it, listed in the final summary.
- Don't edit files another in-progress step is changing.
