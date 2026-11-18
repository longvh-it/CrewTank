# Crew Tanks

Game bắn xe tăng 2D chơi online, 2 đội, 6–8 người, mỗi xe 1–2 người (lái + bắn).

## Bắt đầu

Cần có: Node 20+, pnpm (`npm i -g pnpm`), git, Claude CLI.

```bash
git clone https://github.com/longvh-it/CrewTank.git
cd CrewTank
pnpm install
claude
```

Trong Claude CLI, chạy bước bạn đã nhận (xem docs/ROADMAP.md):

```
/step <số>
```

Xong bước nào thì test theo mục **Hoàn thành khi**, mở PR, merge rồi nhận bước tiếp theo.
Gặp lỗi: `/fix <mô tả lỗi>`.

## Tài liệu

| File | Nội dung |
|---|---|
| `CLAUDE.md` | Luật cho Claude, tự động được đọc mỗi phiên |
| `docs/DESIGN.md` | Luật chơi, chỉ số |
| `docs/ARCHITECTURE.md` | Kiến trúc, cấu trúc repo, giao thức socket, quy tắc sửa file |
| `docs/ROADMAP.md` | 12 bước, người nhận, tiêu chí hoàn thành |
| `docs/WORKFLOW.md` | Quy trình git/PR cho nhóm nhiều người, cách nhận và chia việc, checklist trước sự kiện |
| `docs/CHECKLIST.md` | Checklist phải tick hết trước khi coi một bước là xong |
| `.github/pull_request_template.md` | Mẫu mô tả PR, có sẵn checklist rút gọn |
| `.claude/commands/step.md` | Lệnh `/step <số>` |
| `.claude/commands/fix.md` | Lệnh `/fix <lỗi>` |

## Chạy bằng Docker

```bash
docker build -t crew-tanks .
docker run --rm -p 3000:3000 crew-tanks     # mở http://localhost:3000
```

Một container phục vụ cả client (`client/dist`) lẫn server Socket.IO. Biến môi trường `PORT` đổi cổng (mặc định 3000); `GET /healthz` trả `ok` để kiểm tra sống.

## Deploy lên Railway (hoặc Fly.io)

Cần tài khoản riêng của bạn, phần này làm tay, repo không tự deploy. Yêu cầu của game: **đúng một instance** (toàn bộ trạng thái nằm trong bộ nhớ), WebSocket mở, **không cho ngủ**, vùng **Singapore** (ping < 80 ms ở Việt Nam).

Railway:
1. New Project → Deploy from GitHub repo → chọn repo này; Railway tự nhận `Dockerfile`.
2. Settings → Regions: **Southeast Asia (Singapore)**, Replicas = 1.
3. Settings → bỏ "Serverless"/App Sleeping; Healthcheck path `/healthz`.
4. Settings → Networking → Generate Domain, rồi gửi URL đó (hoặc `…/?room=ABCD`) cho cả nhóm. Railway tự gán `PORT`, không cần đặt biến nào.

Fly.io:
1. `fly launch --no-deploy` (nhận `Dockerfile`; đặt region `sin`, đừng thêm Postgres/Redis).
2. Trong `fly.toml`: `internal_port = 3000`, `[http_service] auto_stop_machines = "off"`, `min_machines_running = 1`, kiểm tra sống `path = "/healthz"`.
3. `fly scale count 1` rồi `fly deploy`.

Trước buổi chơi: bật server trước 30 phút, đừng deploy trong ngày diễn ra sự kiện (xem checklist trong docs/WORKFLOW.md). Mất kết nối giữa trận: client tự vào lại cùng ghế trong 30 giây (F5 cũng được).

## Phân công

Nhóm nhiều người, không chia mảng cố định. Ai rảnh thì nhận một bước trong docs/ROADMAP.md mà các bước phụ thuộc đã merge, ghi tên vào cột **Người nhận**, commit lên `main` rồi bắt đầu làm. Mỗi người giữ một bước cùng lúc.

Bước 1 đã xong. Thứ tự song song gợi ý: 2 → 3 → (4 và 6 song song) → (5 và 7 song song) → (8 và 9 song song) → (10, 11 và 12 song song). Ai chưa nhận được bước thì làm việc chuẩn bị (map Tiled, asset Kenney, phác giao diện sảnh chờ).
