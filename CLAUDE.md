# Crew Tanks — Luật cho Claude

Game xe tăng 2D nhìn từ trên xuống, chơi nhiều người trên trình duyệt. 2 đội, 6–8 người.
Mỗi xe có 1–2 người: người lái (WASD) + pháo thủ (chuột). Xe 1 người = một người làm cả hai việc.

Đọc trước khi làm:
- docs/DESIGN.md        — luật chơi và chỉ số (nguồn chuẩn về gameplay)
- docs/ARCHITECTURE.md  — kiến trúc, cấu trúc repo, giao thức socket
- docs/ROADMAP.md       — 12 bước, người phụ trách, tiêu chí hoàn thành
- docs/WORKFLOW.md      — quy trình git / PR cho nhóm 2 người

## Stack (không thay đổi nếu chưa hỏi)
- TypeScript strict ở mọi nơi. Không dùng `any`, không dùng `@ts-ignore`.
- pnpm workspaces: `shared/`, `server/`, `client/`.
- Client: Vite + React 18 + CHỈ Phaser 3.x (không bao giờ dùng API của Phaser 4) + Zustand.
- Server: Node 20 + Express + Socket.IO v4. Kiểm tra mọi payload từ client bằng Zod.
- Test: Vitest. Map: Tiled JSON. Asset: Kenney Topdown Tanks (CC0).

## Luật kiến trúc
- Server là nguồn quyết định duy nhất (server authoritative). Client chỉ gửi `PlayerInput` — không bao giờ gửi vị trí, máu hay việc trúng đạn.
- Server mô phỏng ở 30 Hz, phát `GameSnapshot` ở 20 Hz.
- Client vẽ trễ 100 ms so với hiện tại và nội suy giữa các snapshot.
- Mọi sự kiện socket và kiểu payload nằm trong `shared/types.ts`. Thêm kiểu trước, rồi mới viết code.
- Mọi con số có thể tinh chỉnh nằm trong `shared/constants.ts`. Không đặt số cứng (magic number) ở nơi khác.
- Vật lý và chia đội là hàm thuần (pure function) trong `shared/`, có unit test.
- Đạn di chuyển theo từng bước nhỏ (tối đa 8 px mỗi bước) để không bao giờ xuyên qua tường.
- React không bao giờ render lại theo từng frame. Phaser chỉ ghi vào Zustand store khi
  máu, điểm, giai đoạn trận (phase) hoặc kill feed thay đổi.
- Phaser scene nhận socket qua constructor; không dùng biến toàn cục.
- Giữ mỗi file dưới ~300 dòng; dài hơn thì tách.

## Quy trình
- Mỗi phiên chỉ làm một bước trong roadmap. Chỉ làm đúng những gì bước đó yêu cầu.
- File dùng chung (`shared/types.ts`, `shared/constants.ts`, `CLAUDE.md`, `docs/*`):
  chỉ sửa khi bước đó cần, và liệt kê mọi thay đổi trong phần tóm tắt cuối.
- Không động vào file thuộc mảng của người kia (xem docs/ROADMAP.md) trừ khi bước đó yêu cầu.
- Không thêm thư viện (dependency) mà không nói rõ lý do.
- Khi gặp lỗi: trước tiên viết một test thất bại tái hiện lỗi, rồi mới sửa.
- Trước khi kết thúc bất kỳ việc gì, chạy: `pnpm typecheck && pnpm test`. Cả hai phải pass.
- Khi không chắc về luật chơi, đọc docs/DESIGN.md. Vẫn chưa rõ → hỏi, đừng đoán.

## Lệnh
- `pnpm dev`        # server :3000 + client :5173 (Vite proxy /socket.io)
- `pnpm build`      # build client vào client/dist; server phục vụ thư mục này
- `pnpm test`
- `pnpm typecheck`
