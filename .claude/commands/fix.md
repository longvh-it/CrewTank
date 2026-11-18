---
description: Sửa lỗi theo cách viết test trước
argument-hint: <mô tả lỗi>
---

Lỗi: $ARGUMENTS

1. Đọc CLAUDE.md. Tìm đoạn code gây ra lỗi; giải thích nguyên nhân gốc trong 2–3 câu.
2. Nếu lỗi nằm trong logic thuộc `shared/`, trước tiên viết một test Vitest bị fail vì lỗi đó.
3. Sửa bằng thay đổi nhỏ nhất có thể. Không động vào các file không liên quan.
4. Chạy `pnpm typecheck && pnpm test` cho đến khi cả hai pass.
5. Hướng dẫn tôi cách kiểm tra bằng tay và gợi ý một commit message.
