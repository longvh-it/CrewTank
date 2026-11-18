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

## Phân công

Nhóm nhiều người, không chia mảng cố định. Ai rảnh thì nhận một bước trong docs/ROADMAP.md mà các bước phụ thuộc đã merge, ghi tên vào cột **Người nhận**, commit lên `main` rồi bắt đầu làm. Mỗi người giữ một bước cùng lúc.

Bước 1 đã xong. Thứ tự song song gợi ý: 2 → 3 → (4 và 6 song song) → (5 và 7 song song) → (8 và 9 song song) → (10, 11 và 12 song song). Ai chưa nhận được bước thì làm việc chuẩn bị (map Tiled, asset Kenney, phác giao diện sảnh chờ).
