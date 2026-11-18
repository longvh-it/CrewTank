# Crew Tanks — Checklist hoàn thành công việc

Dùng mỗi khi xong một bước (hoặc một phần a/b) trong docs/ROADMAP.md. **Chưa tick hết thì chưa phải là xong.**
Tiến độ chung của cả nhóm xem ở cột **Người nhận** và các ô `[x]` trong docs/ROADMAP.md.

## 1. Trước khi mở PR — người làm

**Phạm vi**
- [ ] Chỉ làm đúng bước/phần đã nhận; không làm trước bước sau, không refactor code không liên quan.
- [ ] Không sửa file mà bước khác đang làm dở.
- [ ] File dùng chung bị sửa (`shared/types.ts`, `shared/constants.ts`, `client/src/store.ts`, `server/index.ts`, `CLAUDE.md`, `docs/*`) đã liệt kê trong mô tả PR và đã báo trong nhóm chat.
- [ ] Thư viện mới (nếu có) đã ghi lý do trong mô tả PR.

**Code**
- [ ] TypeScript strict: không `any`, không `@ts-ignore`.
- [ ] Không có số cứng; mọi con số tinh chỉnh nằm trong `shared/constants.ts`.
- [ ] Sự kiện socket / payload mới đã có kiểu trong `shared/types.ts` (thêm kiểu trước, code sau).
- [ ] Payload mới từ client được kiểm tra bằng Zod ở server.
- [ ] Client chỉ gửi `PlayerInput`; không gửi vị trí, máu hay việc trúng đạn.
- [ ] Mỗi file dưới ~300 dòng.

**Test**
- [ ] Mọi hàm thuần mới trong `shared/` có test Vitest.
- [ ] Sửa lỗi: có test tái hiện lỗi (fail trước khi sửa, pass sau khi sửa).
- [ ] `pnpm typecheck && pnpm test` pass trên máy.
- [ ] Đã test bằng tay đúng mục **Hoàn thành khi** của bước, đủ số cửa sổ trình duyệt (một cửa sổ ẩn danh).
- [ ] Console trình duyệt và terminal server không có lỗi mới.

**Git & tài liệu**
- [ ] Nhánh tên `step-NN-ten-buoc` (bước tách phần: `step-06a-...`), đã cập nhật theo `main` mới nhất.
- [ ] Trong cùng PR: đánh dấu `[x]` cho bước trong docs/ROADMAP.md và đổi **Người nhận** thành `đã xong` (cả bảng và dòng của bước).
- [ ] Luật chơi hoặc giao thức có thay đổi → đã cập nhật docs/DESIGN.md / docs/ARCHITECTURE.md.

## 2. Review PR — người review

- [ ] CI xanh.
- [ ] Đọc mục **Hoàn thành khi** của bước; bước có phần chơi được thì tự kéo nhánh về chạy thử.
- [ ] Code đúng phạm vi bước, không lấn sang bước khác.
- [ ] Thay đổi file dùng chung hợp lý; không đổi tên/xóa kiểu hoặc hằng số mà bước khác đang dùng.
- [ ] Hàm thuần mới có test, test kiểm tra đúng luật trong docs/DESIGN.md.

## 3. Sau khi merge — người làm

- [ ] Báo trong nhóm chat: "Bước NN đã merge". Có sửa `types.ts` / `constants.ts` thì nhắc mọi người `git pull`.
- [ ] Xóa nhánh của bước.
- [ ] Nhận bước tiếp theo theo docs/WORKFLOW.md (ưu tiên bước trên đường găng).

## Trước buổi chơi thử và sự kiện

Xem **Checklist trước sự kiện** trong docs/WORKFLOW.md.
