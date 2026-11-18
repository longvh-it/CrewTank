# Crew Tanks — Lộ trình

12 bước. Mỗi phiên Claude chạy một bước: `/step <n>`.
Đánh dấu ô sau khi bước đó đạt **Hoàn thành khi** và đã merge vào `main`.

Nhóm nhiều người (hiện 4), không chia mảng cố định. Ai rảnh thì nhận một bước mà mọi bước phụ thuộc đã merge vào `main`: ghi tên GitHub của mình vào cột **Người nhận** (bảng dưới và dòng của bước), commit thẳng lên `main` trước khi bắt đầu. Mỗi người chỉ giữ một bước cùng lúc.
Test nhiều người chơi bằng 2 cửa sổ trình duyệt trở lên (một cửa sổ ẩn danh).

| # | Bước | Người nhận | Phụ thuộc | Tuần |
|---|---|---|---|---|
| 1 | Khung repo | đã xong | — | 1 |
| 2 | Phaser trong React | longvh-it | 1 | 1 |
| 3 | Di chuyển do server quyết định | — | 2 | 1 |
| 4 | Map + va chạm | — | 3 | 1 |
| 5 | Bắn + máu + hồi sinh | — | 4 | 2 |
| 6a | Phòng theo mã + QR: RoomManager, Trang chủ | — | 1 | 1 |
| 6b | Phòng theo mã: thay phòng toàn cục | — | 3, 6a | 2 |
| 7a | Chia đội: `shared/teams.ts` + test | — | 1 | 1 |
| 7b | Sảnh chờ: giao diện, ghế, bắt đầu trận | — | 6b, 7a | 2 |
| 8 | Tách người lái / pháo thủ | — | 5, 7 | 2 |
| 9 | Team Deathmatch + bảng xếp hạng | — | 5, 7 | 3 |
| 10 | Đạn đặc biệt, tăng tốc, sửa xe, đổi ghế | — | 8 | 3 |
| 11 | Hình ảnh, hiệu ứng, âm thanh, map thứ hai | — | 9 | 3 |
| 12 | Deploy + kết nối lại | — | 9 | 4 |

Bước có phần a/b: "bước N" trong cột Phụ thuộc nghĩa là **cả hai phần** đã merge. Mỗi phần nhận riêng, nhánh riêng (`step-06a-rooms`).

**Đường găng** (chậm một bước là chậm cả dự án): 2 → 3 → 4 → 5 → 8 → 10. Khi có nhiều bước trống, nhận bước trên đường găng trước. Bước 8 cần cả 5 và 7: phần 7b phải merge trước cuối tuần 2.

Việc chuẩn bị không phụ thuộc bước nào, ai chưa nhận được bước thì làm: hai map Tiled (`arena-01`, `arena-02`, ô 32 px, khoảng 40×24 ô, các layer `walls`, `spawns_red`, `spawns_blue`, `pickups`), bộ asset Kenney trong `client/public/assets/`, bản phác giao diện sảnh chờ, và review `shared/types.ts`.

---

## Tuần 1 — nền móng

- [x] **Bước 1 — Khung repo** · Người nhận: đã xong
  - pnpm workspaces `shared`, `server`, `client`; `tsconfig.base.json` (strict); script ở thư mục gốc: `dev` (chạy server + client cùng lúc), `build`, `test`, `typecheck`.
  - Server: Express + Socket.IO ở cổng :3000. Client: Vite + React ở cổng :5173, proxy `/socket.io`.
  - Tạo `shared/types.ts` đúng như trong docs/ARCHITECTURE.md và `shared/constants.ts` từ các chỉ số trong docs/DESIGN.md.
  - Socket có kiểu trong `client/src/net/socket.ts`; trang hiển thị "connected: <socket id>".
  - GitHub Actions `.github/workflows/ci.yml`: cài đặt, chạy `pnpm typecheck`, `pnpm test` cho mọi PR.
  - **Hoàn thành khi:** `pnpm dev` chạy được, trang hiện id đã kết nối, `pnpm typecheck && pnpm test` pass, CI xanh.

- [ ] **Bước 2 — Phaser trong React** · Người nhận: longvh-it
  - `GameCanvas.tsx` gắn một game Phaser 3, hủy nó khi unmount.
  - `BattleScene` vẽ một xe tăng tạm (hình chữ nhật thân xe + nòng pháo), điều khiển cục bộ bằng WASD; tháp pháo xoay theo chuột, độc lập với thân xe.
  - `InputController.ts` chuyển bàn phím/chuột thành `PlayerInput`.
  - **Hoàn thành khi:** xe chạy mượt, tháp pháo xoay độc lập, mount lại không tạo ra canvas thứ hai.

- [ ] **Bước 3 — Di chuyển do server quyết định** · Người nhận: —
  - Client gửi `game:input` 30 lần/s; server chạy vòng lặp `Game.ts` ở 30 Hz dùng `shared/physics.ts` (`moveTank`), phát `GameSnapshot` ở 20 Hz.
  - `Interpolator.ts`: bộ đệm snapshot, vẽ ở thời điểm server − 100 ms, nội suy tuyến tính vị trí, nội suy góc theo cung ngắn nhất.
  - Tạm thời: mọi người vào chung một phòng toàn cục, mỗi người một xe 1 người.
  - **Hoàn thành khi:** 2 cửa sổ thấy xe của nhau di chuyển mượt; đóng một cửa sổ thì xe của nó biến mất; client không bao giờ tự đặt vị trí.

- [ ] **Bước 4 — Map + va chạm** · Người nhận: —
  - `shared/map.ts` đọc Tiled JSON thành lưới va chạm + điểm hồi sinh + điểm vật phẩm. Phaser vẽ đúng map đó.
  - `shared/physics.ts`: va chạm hình tròn với ô tường, trượt dọc theo tường; xe va xe thì đẩy nhau ra.
  - Vitest: lao thẳng vào tường, đi chéo vào góc, trượt dọc tường, hai xe va nhau.
  - **Hoàn thành khi:** test pass; khi chơi, xe không bao giờ đi xuyên tường hoặc bị kẹt vào tường.

## Tuần 2 — bắn, phòng chơi, vai trò

- [ ] **Bước 5 — Bắn + máu + hồi sinh** · Người nhận: —
  - Đạn thường theo constants: thời gian nạp, di chuyển theo bước nhỏ, bật tường tối đa 2 lần, sống 3 s, bắn trúng đồng đội không mất máu.
  - Trúng đạn thì trừ máu; về 0 → sự kiện `kill`, hồi sinh sau 5 s tại điểm hồi sinh của đội, bất tử 2 s.
  - Client: vẽ đạn, nháy sáng khi trúng, thanh máu trên mỗi xe.
  - Vitest: góc bật khi chạm tường dọc/ngang, đạn ở tốc độ tối đa không xuyên qua tường dày 1 ô.
  - **Hoàn thành khi:** test pass; 2 cửa sổ có thể bắn hạ nhau và hồi sinh.

- [ ] **Bước 6a — Phòng theo mã + QR: RoomManager, Trang chủ** · Người nhận: — · *làm được ngay sau bước 1*
  - `RoomManager`: tạo phòng → mã 4 ký tự; vào phòng bằng mã hoặc `/?room=ABCD`; người tạo là chủ phòng; chủ phòng rời đi → người tiếp theo làm chủ phòng; phòng trống bị xóa sau 5 phút.
  - `playerId` cố định lưu trong `localStorage`, gửi kèm khi tạo/vào phòng.
  - Trang chủ: ô nhập tên, nút Tạo phòng, Vào phòng bằng mã. Hiển thị mã phòng + QR (`qrcode.react`).
  - Chưa đụng vào `server/Game.ts` và phòng toàn cục (để phần 6b).
  - **Hoàn thành khi:** hai phòng tồn tại song song, người trong phòng này không thấy người phòng kia; quét QR bằng điện thoại mở đúng URL của phòng.

- [ ] **Bước 6b — Phòng theo mã: thay phòng toàn cục** · Người nhận: —
  - Thay phòng toàn cục ở bước 3: mỗi phòng có game loop riêng, snapshot chỉ phát tới người trong phòng.
  - **Hoàn thành khi:** hai phòng chơi song song, xe phòng này không xuất hiện ở phòng kia.

- [ ] **Bước 7a — Chia đội: `shared/teams.ts` + test** · Người nhận: — · *làm được ngay sau bước 1*
  - `shared/teams.ts`: hàm thuần `autoBalance(players)` theo bảng trong DESIGN.md (6/7/8 người, và ít hơn để test) + kiểm tra hợp lệ khi chọn ghế. Vitest cho 2–8 người.
  - **Hoàn thành khi:** test pass cho 2–8 người, đúng bảng chia đội trong DESIGN.md.

- [ ] **Bước 7b — Sảnh chờ: giao diện, ghế, bắt đầu trận** · Người nhận: —
  - Giao diện sảnh chờ: hai cột cho hai đội; mỗi xe hiện ghế lái và ghế pháo thủ; bấm vào ghế trống để ngồi; chủ phòng kéo thả được người chơi, bấm Tự chia đội, đổi cài đặt, Bắt đầu.
  - `lobby:start` → `game:start` cho mọi người; xe xuất hiện theo các `TankSlot` trong sảnh chờ.
  - **Hoàn thành khi:** test pass; với 4 cửa sổ trở lên, bấm Bắt đầu đưa mọi người vào trận với đúng các xe đã hiện trong sảnh chờ.

- [ ] **Bước 8 — Tách người lái / pháo thủ** · Người nhận: —
  - Server chỉ nhận `move` từ ghế lái và chỉ nhận `aim` từ ghế pháo thủ; xe 1 người nhận cả hai từ người chơi duy nhất.
  - Áp dụng chỉ số xe 2 người từ constants (máu, tốc độ xoay tháp pháo, thời gian nạp đạn).
  - Input phía client: người lái chỉ gửi `move`, pháo thủ chỉ gửi `aim`. HUD hiện "Bạn là NGƯỜI LÁI/PHÁO THỦ" và tên đồng đội cùng xe.
  - **Hoàn thành khi:** trong một xe 2 người, một cửa sổ lái và cửa sổ kia ngắm/bắn; không ai điều khiển được phần của người kia.

## Tuần 3 — hoàn thiện game

- [ ] **Bước 9 — Team Deathmatch + bảng xếp hạng** · Người nhận: —
  - Thắng khi đủ số lượt hạ hoặc khi hết giờ; có thể hòa. HUD: điểm hai đội, đồng hồ, kill feed.
  - `server/Stats.ts`: PlayerStats (lượt hạ tính cho cả hai người trên xe), trợ giúp (gây sát thương trong 5 s trước khi xe bị hạ), danh hiệu theo DESIGN.md.
  - `game:end` → màn hình Bảng xếp hạng → "Về sảnh chờ" giữ nguyên đội và ghế.
  - **Hoàn thành khi:** chạy trọn một vòng sảnh chờ → trận → bảng xếp hạng → trận thứ hai mà không cần tải lại trang; số liệu thống kê đúng.

- [ ] **Bước 10 — Đạn đặc biệt, tăng tốc, sửa xe, đổi ghế** · Người nhận: —
  - Vật phẩm ở các điểm trên map, xuất hiện lại sau 20 s. Đạn nổ lan, đạn xuyên giáp, đạn khói, bộ sửa theo DESIGN.md. Chỉ xe 2 người giữ được đạn đặc biệt.
  - Tăng tốc (người lái, chỉ xe 2 người), giữ R để sửa khi đứng yên, cả hai cùng giữ F 0,5 s để đổi ghế (xe đứng yên 2 s).
  - Khói che các xe bên trong khỏi tầm nhìn của đội địch ở phía client.
  - **Hoàn thành khi:** từng cơ chế được kiểm tra bằng tay trên 2 cửa sổ; các hàm thuần mới đều có test.

- [ ] **Bước 11 — Hình ảnh, hiệu ứng, âm thanh, map thứ hai** · Người nhận: —
  - Thay hình tạm bằng sprite Kenney Topdown Tanks (màu theo đội), hoạt ảnh nổ, rung camera khi xe mình trúng đạn, âm thanh bắn/nổ/nhặt vật phẩm, nút tắt tiếng.
  - Thêm `arena-02`; chủ phòng chọn được map. Khung hướng dẫn phím trong sảnh chờ.
  - **Hoàn thành khi:** trông như một game hoàn chỉnh, giữ 60 FPS trên máy yếu nhất văn phòng.

## Tuần 4 — phát hành

- [ ] **Bước 12 — Deploy + kết nối lại** · Người nhận: —
  - Production: server phục vụ `client/dist`; `Dockerfile`; deploy lên Railway (hoặc Fly.io) vùng Singapore, một instance, không ngủ.
  - Kết nối lại: khi mất kết nối giữ ghế 30 s; cùng `playerId` vào lại đúng xe đó giữa trận.
  - HUD hiện ping.
  - **Hoàn thành khi:** 6–8 người thật chơi qua URL công khai, ping < 80 ms, nhấn F5 giữa trận vào lại đúng xe.

Thời gian còn lại của tuần 4: chơi thử nội bộ, tinh chỉnh `shared/constants.ts`, chạy checklist trước sự kiện trong docs/WORKFLOW.md.

## Sau MVP (chỉ khi còn thời gian)

- Dự đoán phía client (client-side prediction) cho xe của mình nếu lái thấy bị trễ.
- Cướp cờ, phá căn cứ, sương mù chiến tranh, nhảy khỏi xe.
