# Crew Tanks — Kiến trúc

## Tổng quan

```
Trình duyệt (client)                            Server (Node)
┌──────────────────────┐  sự kiện lobby:*   ┌──────────────────────────┐
│ React UI             │ ◄────────────────► │ RoomManager + Room       │
│  (Home/Lobby/HUD/    │                    │  (mã phòng, sảnh, đội)   │
│   Scoreboard)        │                    ├──────────────────────────┤
│        ▲ Zustand     │                    │ Stats (PlayerStats,      │
│        │ (khi đổi)   │                    │  danh hiệu)              │
│ Phaser BattleScene   │  PlayerInput 30/s  ├──────────────────────────┤
│        ▲             │ ─────────────────► │ Game loop 30 Hz          │
│ Interpolator (−100ms)│ ◄───────────────── │  input → vật lý →        │
└──────────────────────┘  GameSnapshot 20/s │  trúng đạn → xét thắng   │
                          + game:event      └──────────────────────────┘
            └─────────── cả hai import shared/ ───────────┘
```

- **Server là nguồn quyết định duy nhất.** Client chỉ gửi input. Server nắm vị trí, máu, trúng đạn, điểm số.
- **Tick:** mô phỏng mỗi 33 ms (30 Hz); phát `game:state` tới cả phòng sau mỗi 2 tick (≈20 Hz).
- **Sự kiện rời rạc** (`game:event`: hit, kill, explode, pickup) được gửi ngay lập tức.
- **Nội suy phía client:** giữ một bộ đệm snapshot, vẽ ở thời điểm `serverTime − 100 ms`, nội suy tuyến tính vị trí và góc (góc nội suy theo cung ngắn nhất).
- **Đồng bộ thời gian server:** client ước lượng độ lệch từ `GameSnapshot.t` (trung bình trượt đơn giản).
- Một instance server; toàn bộ trạng thái nằm trong bộ nhớ. Không có cơ sở dữ liệu.

## Một tick của server (theo thứ tự)

1. Lấy input mới nhất của từng người chơi. `move` chỉ lấy từ ghế lái, `aim` chỉ lấy từ ghế pháo thủ; xe 1 người lấy cả hai từ người chơi duy nhất.
2. Di chuyển xe; va chạm với ô tường (hình tròn với lưới ô, trượt dọc theo tường) và với các xe khác.
3. Sinh đạn nếu đã nạp xong; di chuyển đạn theo bước nhỏ ≤ 8 px; bật khi chạm tường (đảo vận tốc theo trục va chạm).
4. Xử lý trúng đạn → máu, thống kê, lượt hạ, hồi sinh, nhặt vật phẩm, vùng khói.
5. Kiểm tra điều kiện thắng.
6. Phát snapshot sau mỗi 2 tick.

## Cấu trúc repo

```
crew-tanks/
├─ CLAUDE.md
├─ package.json            # script: dev, build, test, typecheck
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ .github/workflows/ci.yml
├─ docs/                   # DESIGN, ARCHITECTURE, ROADMAP, WORKFLOW
├─ shared/
│  ├─ types.ts             # mọi kiểu domain + socket (hợp đồng chung)
│  ├─ constants.ts         # mọi con số có thể tinh chỉnh
│  ├─ physics.ts           # hàm thuần: moveTank, stepBullet, collideTanks...
│  ├─ teams.ts             # hàm thuần: autoBalance, luật chọn ghế
│  ├─ map.ts               # đọc Tiled JSON → lưới va chạm, điểm hồi sinh, vật phẩm
│  └─ *.test.ts
├─ server/
│  ├─ index.ts             # Express + Socket.IO, phục vụ client/dist khi chạy production
│  ├─ RoomManager.ts       # tạo/vào/dọn phòng, mã 4 ký tự
│  ├─ Room.ts              # trạng thái sảnh chờ, ghế, chuyển giai đoạn trận
│  ├─ Game.ts              # vòng lặp game, dùng shared/physics
│  ├─ Stats.ts             # PlayerStats, danh hiệu
│  ├─ validate.ts          # schema Zod cho mọi payload từ client
│  └─ maps/arena-01.json, arena-02.json
└─ client/
   ├─ index.html
   ├─ vite.config.ts       # proxy /socket.io → :3000
   ├─ src/main.tsx
   ├─ src/net/socket.ts    # một Socket<ServerToClient, ClientToServer> có kiểu
   ├─ src/store.ts         # Zustand: phase, lobby, hud, killFeed, results
   ├─ src/ui/              # Home, Lobby, Hud, Scoreboard, ControlsHelp
   ├─ src/game/            # GameCanvas.tsx, BattleScene.ts, Interpolator.ts, InputController.ts
   └─ public/assets/       # sprite Kenney, âm thanh, map
```

## Phân chia file (nhóm nhiều người)

Không có chủ sở hữu cố định. File thuộc về người đang giữ bước có sửa file đó (xem cột **Người nhận** trong docs/ROADMAP.md).

| Đường dẫn | Quy tắc |
|---|---|
| `shared/physics.ts`, `shared/map.ts`, `server/Game.ts`, `client/src/game/*` | Nhóm gameplay — tránh hai bước song song cùng sửa |
| `shared/teams.ts`, `server/RoomManager.ts`, `server/Room.ts`, `server/Stats.ts`, `client/src/ui/*`, các file deploy | Nhóm phòng chơi & trải nghiệm — tránh hai bước song song cùng sửa |
| `shared/types.ts`, `shared/constants.ts`, `client/src/store.ts`, `server/index.ts`, `CLAUDE.md`, `docs/*` | Dùng chung — PR cần ít nhất 1 người khác review |

## Giao thức socket — `shared/types.ts` (điểm khởi đầu)

```ts
export type TeamId = 'red' | 'blue';
export type Seat = 'driver' | 'gunner';
export type Phase = 'lobby' | 'playing' | 'ended';
export type AmmoKind = 'normal' | 'explosive' | 'piercing' | 'smoke';

export interface PlayerInfo {
  id: string;            // playerId cố định (lưu trong localStorage), không phải socket.id
  name: string;
  team: TeamId | null;
  tankId: string | null;
  seat: Seat | null;
  isHost: boolean;
  connected: boolean;
}

export interface TankSlot {
  id: string;
  team: TeamId;
  driverId: string | null;
  gunnerId: string | null;
}

export interface LobbySettings { killLimit: number; timeLimitSec: number; mapId: string }

export interface LobbyState {
  code: string;
  phase: Phase;
  players: PlayerInfo[];
  tanks: TankSlot[];
  settings: LobbySettings;
}

export interface PlayerInput {
  seq: number;
  move?: { throttle: -1 | 0 | 1; turn: -1 | 0 | 1; boost: boolean; repair: boolean };
  aim?: { angle: number; fire: boolean; special: boolean };
  swap: boolean;
}

export interface TankState {
  id: string; team: TeamId;
  x: number; y: number; bodyAngle: number; turretAngle: number;
  hp: number; maxHp: number; alive: boolean; respawnAt: number | null;
  crew: 1 | 2; specialAmmo: number; specialKind: AmmoKind | null; boostReadyAt: number;
}

export interface BulletState { id: string; x: number; y: number; kind: AmmoKind }

export interface PickupState { id: string; x: number; y: number; kind: AmmoKind | 'repair'; active: boolean }

export interface SmokeZone { id: string; x: number; y: number; r: number; endsAt: number }

export interface GameSnapshot {
  t: number;                         // thời gian server, ms
  tanks: TankState[];
  bullets: BulletState[];
  pickups: PickupState[];
  smokes: SmokeZone[];
  score: Record<TeamId, number>;
  endsAt: number;
}

export interface PlayerStats {
  playerId: string; kills: number; assists: number; deaths: number;
  damage: number; shots: number; hits: number;
}

export type GameEvent =
  | { type: 'hit'; tankId: string; dmg: number }
  | { type: 'kill'; killerTankId: string; victimTankId: string }
  | { type: 'explode'; x: number; y: number; r: number }
  | { type: 'pickup'; tankId: string; kind: AmmoKind | 'repair' };

export interface MatchResult {
  winner: TeamId | null;
  score: Record<TeamId, number>;
  stats: PlayerStats[];
  awards: { mvp?: string; bestDriver?: string; bestDuo?: [string, string] };
}

type Ack<T> = (r: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface ClientToServer {
  'room:create': (name: string, playerId: string, ack: Ack<{ code: string }>) => void;
  'room:join': (code: string, name: string, playerId: string, ack: Ack<{}>) => void;
  'lobby:pickSeat': (tankId: string, seat: Seat) => void;
  'lobby:leaveSeat': () => void;
  'lobby:movePlayer': (playerId: string, tankId: string, seat: Seat) => void; // chỉ chủ phòng
  'lobby:autoBalance': () => void;                                             // chỉ chủ phòng
  'lobby:settings': (s: Partial<LobbySettings>) => void;                       // chỉ chủ phòng
  'lobby:start': () => void;                                                   // chỉ chủ phòng
  'game:input': (input: PlayerInput) => void;
}

export interface ServerToClient {
  'lobby:state': (s: LobbyState) => void;
  'game:start': (mapId: string) => void;
  'game:state': (s: GameSnapshot) => void;
  'game:event': (e: GameEvent) => void;
  'game:end': (r: MatchResult) => void;
}
```

Quy tắc:
- Mọi payload từ client được parse bằng Zod trong `server/validate.ts`; không hợp lệ → bỏ qua (và ghi log khi chạy dev).
- Giới hạn input tối đa 40 lần/s cho mỗi socket.
- Mất kết nối: giữ ghế của người chơi 30 s (`connected: false`), vào lại bằng cùng `playerId`.
- Mã phòng: 4 ký tự lấy từ `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Phòng trống bị xóa sau 5 phút.
