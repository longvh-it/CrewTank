## Bước

Bước NN — <tên bước> (docs/ROADMAP.md)

## Đã làm

-

## File dùng chung bị sửa

Không có / liệt kê:

## Thư viện mới (và lý do)

Không có / liệt kê:

## Cách test bằng tay

Số cửa sổ trình duyệt: …
1.

## Checklist (chi tiết ở docs/CHECKLIST.md)

- [ ] Chỉ làm đúng bước/phần đã nhận, không sửa file bước khác đang làm dở
- [ ] Không `any` / `@ts-ignore`, không số cứng ngoài `shared/constants.ts`
- [ ] Kiểu mới đã thêm vào `shared/types.ts`; client chỉ gửi `PlayerInput`
- [ ] Hàm thuần mới trong `shared/` có test; sửa lỗi có test tái hiện
- [ ] `pnpm typecheck && pnpm test` pass
- [ ] Đã test bằng tay theo **Hoàn thành khi**, không có lỗi mới trong console
- [ ] Đã đánh dấu `[x]` và đổi **Người nhận** thành `đã xong` trong docs/ROADMAP.md
