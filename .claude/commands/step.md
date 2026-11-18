---
description: Làm một bước trong roadmap ở docs/ROADMAP.md
argument-hint: <số thứ tự bước>
---

Làm **Bước $ARGUMENTS** trong docs/ROADMAP.md.

1. Đọc CLAUDE.md, docs/ROADMAP.md (Bước $ARGUMENTS), và những phần trong docs/DESIGN.md và docs/ARCHITECTURE.md mà bước này cần.
2. Kiểm tra các bước mà bước này phụ thuộc đã có trong code chưa. Nếu chưa, dừng lại và báo tôi còn thiếu gì.
3. Trước khi viết code, đưa tôi một kế hoạch ngắn: các file sẽ tạo/sửa, thay đổi nào ở file dùng chung (`shared/types.ts`, `shared/constants.ts`, `client/src/store.ts`, `server/index.ts`), thư viện mới và lý do. Sau đó làm tiếp.
4. Chỉ làm bước này. Không bắt đầu bước tiếp theo. Không refactor code không liên quan.
5. Viết hoặc cập nhật test Vitest cho mọi hàm thuần mới trong `shared/`.
6. Chạy `pnpm typecheck && pnpm test` và sửa cho đến khi cả hai pass.
7. Kết thúc bằng:
   - Đã làm gì, theo từng file.
   - Thay đổi ở file dùng chung (hoặc "không có").
   - Cách tôi kiểm tra bằng tay để xác nhận **Hoàn thành khi** (các bước cụ thể, cần bao nhiêu cửa sổ trình duyệt).
   - Một commit message gợi ý.
