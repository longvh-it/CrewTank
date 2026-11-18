# Hướng dẫn cho repo

## Tổng quan dự án
Crew Tanks: game xe tăng 2D nhìn từ trên xuống, chơi nhiều người trên trình duyệt, dùng cho team building công ty. 2 đội, 6–8 người; mỗi xe có 1–2 người (người lái = WASD, pháo thủ = chuột; xe 1 người làm cả hai việc). Làm theo 12 bước trong roadmap (`docs/ROADMAP.md`, bước 6 và 7 tách thành phần a/b); mới xong bước 1 (khung repo) — phần lớn module trong `docs/ARCHITECTURE.md` vẫn đang ở dạng kế hoạch.

Tài liệu viết bằng tiếng Việt; trả lời nhóm bằng tiếng Việt. Nguồn chuẩn: `docs/DESIGN.md` (luật chơi, chỉ số), `docs/ARCHITECTURE.md` (cấu trúc, giao thức socket), `docs/ROADMAP.md` (các bước, người nhận, tiêu chí hoàn thành), `docs/WORKFLOW.md` (nhận việc, git/PR), `docs/CHECKLIST.md` (checklist hoàn thành một bước), `CLAUDE.md` (luật cho agent).

## Kiến trúc & luồng dữ liệu
- **Server là nguồn quyết định duy nhất.** Client chỉ gửi `PlayerInput` (`game:input`, 30 lần/s). Không bao giờ gửi vị trí, máu hay việc trúng đạn từ client.
- Server: mô phỏng ở `TICK_HZ` (30), phát `GameSnapshot` qua `game:state` bằng timer riêng ở `SNAPSHOT_HZ` (20); sự kiện rời rạc `game:event` (hit/kill/explode/pickup) gửi ngay.
- Client vẽ trễ `INTERP_DELAY_MS` (100 ms) so với hiện tại, nội suy tuyến tính vị trí và nội suy góc theo cung ngắn nhất (dự kiến ở `client/src/game/Interpolator.ts`).
- Thứ tự một tick: input (`move` chỉ từ ghế lái, `aim` chỉ từ ghế pháo thủ) → di chuyển + va chạm tường/xe → sinh đạn/di chuyển đạn theo bước nhỏ (≤ `BULLET_MAX_SUBSTEP` = 8 px) → trúng đạn/máu/lượt hạ/hồi sinh/vật phẩm → kiểm tra thắng → snapshot.
- Socket.IO có kiểu ở cả hai phía, generic lấy từ `shared/types.ts`:
  - server: `new Server<ClientToServer, ServerToClient>(httpServer)` (`server/index.ts`)
  - client: `type GameSocket = Socket<ServerToClient, ClientToServer>` + `createSocket()` (`client/src/net/socket.ts`, `io()` cùng origin)
- Ack dùng `Ack<T>`: `({ ok: true } & T) | { ok: false; error: string }`.
- Dự kiến: kiểm tra mọi payload từ client bằng Zod trong `server/validate.ts` (không hợp lệ → bỏ qua, ghi log khi chạy dev), giới hạn 40 input/s mỗi socket, Zustand store chỉ cập nhật khi máu/điểm/phase/kill feed thay đổi (React không bao giờ render lại theo từng frame), Phaser scene nhận socket qua constructor (không dùng biến toàn cục). Trạng thái chỉ nằm trong bộ nhớ, không có cơ sở dữ liệu.

## Thư mục chính
- `shared/` — `@crew-tanks/shared`: kiểu giao thức, hằng số, và (dự kiến) các hàm thuần `physics.ts`, `teams.ts`, `map.ts` kèm test.
- `server/` — Express + Socket.IO; dự kiến `RoomManager.ts`, `Room.ts`, `Game.ts`, `Stats.ts`, `validate.ts`, `maps/*.json`.
- `client/` — Vite + React; `src/net/`, dự kiến `src/ui/` (Home, Lobby, Hud, Scoreboard), `src/game/` (Phaser), `src/store.ts`, `public/assets/` (sprite Kenney, map Tiled).
- `.claude/commands/` — prompt cho `/step <n>` (vd. `/step 5`, `/step 6a`) và `/fix <lỗi>`.
- `.github/` — CI (`workflows/ci.yml`) và mẫu mô tả PR (`pull_request_template.md`).

## Lệnh phát triển
```bash
pnpm install
pnpm dev         # server :3000 (tsx watch) + client :5173 (Vite, proxy /socket.io kể cả ws)
pnpm build       # chỉ build client -> client/dist (server phục vụ nếu thư mục tồn tại)
pnpm start       # chạy server bằng tsx, biến môi trường PORT ghi đè cổng 3000
pnpm typecheck   # tsc --noEmit trong từng package
pnpm test        # vitest run --passWithNoTests
```
Chưa cấu hình linter/formatter. Bắt buộc pass `pnpm typecheck && pnpm test` trước khi kết thúc bất kỳ việc gì.

## Quy ước code & mẫu thường dùng
- TypeScript strict (`noUncheckedIndexedAccess`, `noImplicitOverride`, `isolatedModules`). Không `any`, không `@ts-ignore`.
- Hợp đồng trước: thêm/sửa kiểu sự kiện hoặc payload trong `shared/types.ts`, rồi mới viết code.
- Mọi con số tinh chỉnh nằm trong `shared/constants.ts`, export dạng `UPPER_SNAKE` (vd. `TANK_STATS[crew]`, `BULLET_SPEED`); không đặt số cứng ở nơi khác.
- Import shared qua subpath export: `import type { GameSnapshot } from '@crew-tanks/shared/types'`, `import { TICK_HZ } from '@crew-tanks/shared/constants'` (trỏ thẳng tới file `.ts`, không cần bước build).
- Dùng named export (`export function App`); tên file PascalCase cho class/component (`Game.ts`, `BattleScene.ts`), camelCase cho module (`socket.ts`, `physics.ts`).
- Vật lý và chia đội là hàm thuần trong `shared/`, có unit test.
- Mỗi file dưới ~300 dòng. Chỉ dùng API Phaser 3 (không bao giờ dùng Phaser 4).
- Thêm thư viện mới phải nêu lý do.

## File quan trọng
- `server/index.ts` — điểm vào của server, phục vụ tĩnh `client/dist`.
- `client/src/main.tsx` → `App.tsx` — điểm vào của client (StrictMode).
- `shared/types.ts`, `shared/constants.ts` — hợp đồng dùng chung.
- `client/vite.config.ts` — cổng dev + proxy (đọc từ constants).
- `tsconfig.base.json`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml`.

## Công cụ & môi trường
- Node ≥ 20 (CI dùng 20), pnpm 12.4.2 (`packageManager`). Không dùng Bun.
- Chính sách pnpm 12: `allowBuilds: esbuild: true` trong `pnpm-workspace.yaml`; package mới phát hành chưa đủ `minimumReleaseAge` có thể bị từ chối — nếu cài đặt lỗi vì lý do này thì tạo lại lockfile.
- Stack cố định: Vite + React 18 + Phaser 3 + Zustand; Express + Socket.IO v4 + Zod; Vitest; map Tiled JSON; Kenney Topdown Tanks (CC0).

## Test & kiểm thử
- Vitest, cấu hình `vitest.config.ts`, glob `shared/**/*.test.ts`, `server/**/*.test.ts`, `client/src/**/*.test.ts`. Hiện chưa có test nào.
- Mọi hàm thuần mới trong `shared/` phải có test (dự kiến: va chạm tường/góc/trượt tường/xe với xe, đạn bật tường + không xuyên tường ở tốc độ tối đa, `autoBalance` cho 2–8 người).
- Sửa lỗi: viết test tái hiện lỗi (fail) trước.
- Kiểm thử nhiều người chơi bằng tay: 2 cửa sổ trình duyệt trở lên (một cửa sổ ẩn danh), theo mục **Hoàn thành khi** của từng bước.
- CI chạy cài đặt (lockfile cố định), typecheck, test cho PR và khi push lên `main`; CI không build.

## Quy trình làm việc
- Nhóm nhiều người; nhận một bước (hoặc một phần a/b) có các bước phụ thuộc đã merge bằng cách ghi tên GitHub vào cột **Người nhận** và commit lên `main`. Mỗi người / mỗi phiên một bước; chỉ làm đúng bước đó.
- Có nhiều bước trống thì ưu tiên đường găng: 2 → 3 → 4 → 5 → 8 → 10. Phần 6a và 7a làm được ngay sau bước 1.
- Nhánh `step-NN-ten-buoc` (bước tách phần: `step-06a-...`); PR nhỏ, ít nhất 1 người review; chỉ sửa file dùng chung (`shared/types.ts`, `shared/constants.ts`, `client/src/store.ts`, `server/index.ts`, `CLAUDE.md`, `docs/*`) khi bước cần, và liệt kê trong phần tóm tắt cuối. Ưu tiên thêm mới, hạn chế đổi tên/xóa kiểu hoặc hằng số đang dùng.
- Không sửa file mà một bước khác đang làm dở.
- Trước khi coi một bước là xong: đi hết `docs/CHECKLIST.md`.
