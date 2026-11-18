# Crew Tanks

Game bắn xe tăng 2D chơi online, 2 đội, 6–8 người, mỗi xe 1–2 người (lái + bắn).

## Bắt đầu

Cần có: Node 20+, pnpm (`npm i -g pnpm`), git, Claude CLI.

```bash
cd crew-tanks
git init && git add . && git commit -m "docs: project plan"
# tạo repo trên GitHub rồi push, mời bạn cùng làm
claude
```

Trong Claude CLI:

```
/step 1
```

Xong bước nào thì test theo mục **Hoàn thành khi**, commit, rồi chạy `/step` tiếp theo.
Gặp lỗi: `/fix <mô tả lỗi>`.

## Tài liệu

| File | Nội dung |
|---|---|
| `CLAUDE.md` | Luật cho Claude, tự động được đọc mỗi phiên |
| `docs/DESIGN.md` | Luật chơi, chỉ số |
| `docs/ARCHITECTURE.md` | Kiến trúc, cấu trúc repo, giao thức socket, phân chia file theo người |
| `docs/ROADMAP.md` | 12 bước, người phụ trách, tiêu chí hoàn thành |
| `docs/WORKFLOW.md` | Quy trình git/PR khi làm 2 người, checklist trước sự kiện |
| `.claude/commands/step.md` | Lệnh `/step <số>` |
| `.claude/commands/fix.md` | Lệnh `/fix <lỗi>` |

## Phân công

- **A – Gameplay:** bước 1, 2, 3, 4, 5, 8, 10
- **B – Phòng chơi và trải nghiệm:** bước 6, 7, 9, 11, 12. Trong tuần 1 chuẩn bị map Tiled, asset Kenney, phác giao diện sảnh chờ.
