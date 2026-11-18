# Crew Tanks — Quy trình làm việc nhóm

Nhóm nhiều người (hiện 4), mỗi người dùng Claude CLI, nhận việc theo từng bước trong docs/ROADMAP.md. Mục tiêu: làm song song mà không làm hỏng code của nhau.

## Nhận việc

1. Mở docs/ROADMAP.md, chọn một bước có **Người nhận** là `—` và mọi bước phụ thuộc đã merge.
2. Ghi tên GitHub của mình vào cột **Người nhận** (bảng + dòng của bước), commit `docs: nhận bước NN` thẳng lên `main`, push. Push bị từ chối vì người khác vừa nhận → `git pull --rebase`, chọn bước khác nếu trùng.
3. Mỗi người giữ một bước cùng lúc. Bỏ dở thì đổi lại thành `—`.
4. Có nhiều bước trống → nhận bước nằm trên **đường găng** trước (2 → 3 → 4 → 5 → 8 → 10, xem docs/ROADMAP.md).
5. Bước có phần a/b (6a, 6b, 7a, 7b) thì mỗi phần nhận riêng như một bước.
6. Không có bước nào nhận được → làm việc chuẩn bị trong docs/ROADMAP.md, review PR đang mở, hoặc viết thêm test. **Không** làm trước một bước chưa nhận.

## Việc làm một lần khi bắt đầu

- Bật **branch protection** cho `main`: bắt buộc qua PR và CI xanh mới được merge. Ngoại lệ duy nhất: commit nhận bước (`docs: nhận bước NN`) được đẩy thẳng lên `main`.
- Lập nhóm chat chung để báo khi nhận bước, khi sửa file dùng chung, khi merge.
- Cả nhóm đọc và chốt `shared/types.ts` và `shared/constants.ts`. Đây là "hợp đồng" chung giữa mọi bước, đổi về sau gây xung đột nhiều nhất.

## Chia việc ngay sau bước 1 (ví dụ 4 người)

Chuỗi 2 → 3 → 4 → 5 phải làm nối tiếp, nên các phần a và việc chuẩn bị là để không ai phải ngồi chờ:

| Người | Việc |
|---|---|
| 1 | Bước 2, rồi 3, 4, 5 (đường găng) — nên là người code chắc tay nhất |
| 2 | Bước 6a (RoomManager, Trang chủ) |
| 3 | Bước 7a (`shared/teams.ts` + test) |
| 4 | Việc chuẩn bị: map Tiled, asset Kenney, phác giao diện sảnh chờ |

Sau đó cứ ai xong thì nhận bước tiếp theo theo cột **Phụ thuộc**. Điểm nghẽn tiếp theo là bước 8: cần cả 5 và 7b, nên 7b phải merge trước cuối tuần 2.

## Git

- Repo trên GitHub. `main` lúc nào cũng phải chạy được.
- Mỗi bước trong roadmap một nhánh: `step-05-shooting`, `step-07b-lobby`. Bước có phần a/b thì ghi cả chữ cái: `step-06a-rooms`.
- PR nhỏ, merge ít nhất mỗi ngày một lần. Không để nhánh nào cũ quá 2 ngày.
- CI (`pnpm typecheck && pnpm test`) phải xanh trước khi merge.
- Ít nhất 1 người khác review mọi PR; PR có sửa file dùng chung (xem bảng phân chia file trong ARCHITECTURE.md) phải có review trước khi merge.
- Commit sau mỗi phần nhỏ chạy được. Nếu Claude làm hỏng gì đó: `git restore .` hoặc `git reset --hard` về commit tốt gần nhất.

## File dùng chung

`shared/types.ts`, `shared/constants.ts`, `client/src/store.ts`, `server/index.ts`, `CLAUDE.md`, `docs/*`

- Khi có thể, sửa chúng trong một PR nhỏ riêng, merge trước PR tính năng.
- Báo trong nhóm chat khi bạn sửa `types.ts` hoặc `constants.ts` để mọi người pull về ngay.
- Ưu tiên **thêm** kiểu/trường mới; hạn chế đổi tên hoặc xóa cái đã có. Bắt buộc phải đổi → thống nhất trong nhóm chat trước, vì có thể làm hỏng bước người khác đang làm.

## Mỗi phiên Claude

1. `git checkout main && git pull`
2. `git checkout -b step-NN-ten-buoc`
3. Trong Claude CLI: `/step NN`
4. Test bằng tay theo mục **Hoàn thành khi** (2 cửa sổ trình duyệt trở lên).
5. `pnpm typecheck && pnpm test`
6. Đi hết docs/CHECKLIST.md, rồi commit, push, mở PR (mẫu PR có sẵn checklist rút gọn), đánh dấu bước đó trong docs/ROADMAP.md.

Nếu Claude đi lạc hướng: dừng lại, `git restore .`, rồi chạy lại với yêu cầu hẹp hơn
(ví dụ: "chỉ làm phần đạn bật tường của bước 5").

## Họp nhanh hằng ngày (15 phút)

- Mình đang ở bước nào, đang vướng gì.
- Có ai sửa `shared/types.ts` hoặc `constants.ts` không?
- Thứ tự merge tiếp theo. Bước trên đường găng có ai đang giữ không, có bị kẹt không?
- 7b có kịp trước bước 8 không?

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
