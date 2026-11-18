# Crew Tanks — Quy trình làm việc nhóm

Hai người, mỗi người dùng Claude CLI. Mục tiêu: làm song song mà không làm hỏng code của nhau.

## Git

- Repo trên GitHub. `main` lúc nào cũng phải chạy được.
- Mỗi bước trong roadmap một nhánh: `step-05-shooting`, `step-07-lobby`.
- PR nhỏ, merge ít nhất mỗi ngày một lần. Không để nhánh nào cũ quá 2 ngày.
- CI (`pnpm typecheck && pnpm test`) phải xanh trước khi merge.
- Người kia review các PR có sửa file dùng chung (xem bảng phân chia file trong ARCHITECTURE.md).
- Commit sau mỗi phần nhỏ chạy được. Nếu Claude làm hỏng gì đó: `git restore .` hoặc `git reset --hard` về commit tốt gần nhất.

## File dùng chung

`shared/types.ts`, `shared/constants.ts`, `client/src/store.ts`, `server/index.ts`, `CLAUDE.md`, `docs/*`

- Khi có thể, sửa chúng trong một PR nhỏ riêng, merge trước PR tính năng.
- Báo trong nhóm chat khi bạn sửa `types.ts` để người kia pull về.

## Mỗi phiên Claude

1. `git checkout main && git pull`
2. `git checkout -b step-NN-ten-buoc`
3. Trong Claude CLI: `/step NN`
4. Test bằng tay theo mục **Hoàn thành khi** (2 cửa sổ trình duyệt trở lên).
5. `pnpm typecheck && pnpm test`
6. Commit, push, mở PR, đánh dấu bước đó trong docs/ROADMAP.md.

Nếu Claude đi lạc hướng: dừng lại, `git restore .`, rồi chạy lại với yêu cầu hẹp hơn
(ví dụ: "chỉ làm phần đạn bật tường của bước 5").

## Họp nhanh hằng ngày (15 phút)

- Mình đang ở bước nào, đang vướng gì.
- Có ai sửa `shared/types.ts` hoặc `constants.ts` không?
- Thứ tự merge tiếp theo.

## Chơi thử

- Cuối tuần 2 và cuối tuần 3: 15 phút với 3–4 đồng nghiệp.
- Ghi lại: ai thắng, chỗ nào thấy không công bằng, lỗi gì. Biến những gì ghi được thành thay đổi trong `constants.ts` hoặc việc mới.

## Checklist trước sự kiện

- [ ] Mở URL bằng Wi-Fi văn phòng; WebSocket không bị chặn
- [ ] Chơi trọn một trận với 8 người thật
- [ ] Đã test trên Chrome, Edge và máy yếu nhất trong phòng
- [ ] Mã QR đã in ra hoặc chiếu trên màn hình lớn
- [ ] Hướng dẫn phím hiển thị trong sảnh chờ
- [ ] Bật server trước 30 phút; không deploy trong ngày diễn ra sự kiện
- [ ] Chuẩn bị sẵn giải thưởng cho MVP và Cặp đôi ăn ý
