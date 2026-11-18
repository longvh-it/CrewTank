# Crew Tanks — Thiết kế game

Game bắn xe tăng 2D nhìn từ trên xuống, chơi online trên trình duyệt PC, 2 đội, 6–8 người. Mỗi xe 1–2 người: người lái + pháo thủ. Dùng cho team building công ty.

Nguyên tắc cân bằng: xe 2 người phải được thưởng đủ mạnh để mọi người muốn ngồi chung xe. Nếu không, một người tự lái tự bắn (WASD + chuột) sẽ mạnh hơn hai người chưa ăn ý.

## Phạm vi MVP

- Có: sảnh chờ, tạo/vào phòng bằng mã 4 ký tự + QR, chia đội, chọn ghế, Team Deathmatch, 2 map, đạn bật tường, đạn nhặt trên map, tăng tốc, sửa xe, đổi ghế, bảng xếp hạng sau trận.
- Không có: đăng nhập, voice chat, cướp cờ, phá căn cứ, sương mù chiến tranh, bản mobile.

## Điều khiển

| Ghế | Phím | Việc |
|---|---|---|
| Người lái | W/S tiến lùi, A/D xoay thân xe, Shift tăng tốc, giữ R sửa xe (khi đứng yên) | Di chuyển, né đạn, sửa xe |
| Pháo thủ | Chuột ngắm, click trái bắn, click phải bắn đạn đặc biệt | Xoay tháp pháo, bắn |
| Xe 1 người | WASD + chuột + Shift + R | Làm cả hai việc |
| Cả hai người trên xe | Cùng giữ F trong 0,5 giây | Đổi ghế, xe đứng yên 2 giây |

## Chia đội tự động

| Số người | Mỗi đội |
|---|---|
| 6 | 1 xe 2 người + 1 xe 1 người |
| 7 | Đội 4 người: 2 xe 2 người. Đội 3 người: 1 xe 2 người + 1 xe 1 người được thêm 20% máu |
| 8 | 2 xe 2 người |

- Dưới 6 người vẫn cho chơi (để test), chia đều nhất có thể.
- Chủ phòng kéo thả được người chơi giữa các đội và các ghế trước khi bắt đầu.
- Người chơi tự bấm vào ghế trống để ngồi.

## Chỉ số khởi điểm

Tất cả số dưới đây nằm trong `shared/constants.ts`, sẽ chỉnh sau mỗi buổi chơi thử.

| Chỉ số | Xe 1 người | Xe 2 người |
|---|---|---|
| Máu | 100 | 130 |
| Tốc độ | 160 px/s | 150 px/s |
| Tăng tốc | không có | 240 px/s trong 1,5 s, hồi chiêu 6 s |
| Tốc độ xoay thân | 150°/s | 150°/s |
| Tốc độ xoay tháp pháo | 180°/s | 270°/s |
| Thời gian nạp đạn | 0,8 s | 0,6 s |
| Đạn đặc biệt | không nhặt được | giữ tối đa 3 viên |
| Sửa xe | +15 máu/s | +15 máu/s |

- Bán kính va chạm của xe: 18 px. Ô map: 32 px.
- Đạn thường: 400 px/s, 20 sát thương, bật tường tối đa 2 lần, sống tối đa 3 s, bắn trúng đồng đội không mất máu.
- Hồi sinh: sau 5 s tại căn cứ của đội, bất tử 2 s.
- Trợ giúp (assist): gây sát thương lên xe bị hạ trong 5 s trước đó.

## Vật phẩm nhặt trên map

| Vật phẩm | Hiệu ứng |
|---|---|
| Đạn nổ lan | Nổ bán kính 80 px, 30 sát thương |
| Đạn xuyên giáp | 40 sát thương, không bật tường |
| Đạn khói | Tạo vùng khói bán kính 100 px trong 6 s, che xe bên trong |
| Bộ sửa | Hồi ngay 40 máu (xe nào cũng nhặt được) |

Vật phẩm xuất hiện lại sau 20 s tại các điểm cố định trên map.

## Chế độ chơi: Team Deathmatch

- Đội nào hạ đủ 15 lượt trước thì thắng, hoặc đội nhiều điểm hơn khi hết 8 phút. Hòa điểm thì hòa.
- Chủ phòng chỉnh được số lượt hạ (5–50), thời gian (3–15 phút) và map.

## Bảng xếp hạng sau trận

- Mỗi người: số mạng hạ, trợ giúp, số lần bị hạ, sát thương gây ra, tỉ lệ bắn trúng.
- Lượt hạ của xe 2 người được tính cho cả hai người.
- Danh hiệu:
  - **MVP**: nhiều điểm nhất (hạ = 3 điểm, trợ giúp = 1 điểm, sát thương/50).
  - **Tay lái lụa**: người lái bị trúng ít đạn nhất trên mỗi phút.
  - **Cặp đôi ăn ý**: xe 2 người gây nhiều sát thương nhất.

## Màn hình

Trang chủ (nhập tên, tạo hoặc nhập mã phòng) → Sảnh chờ (chọn đội và ghế, chủ phòng bấm bắt đầu) → Trận đấu → Bảng xếp hạng → về lại Sảnh chờ. Link `/?room=ABCD` bỏ qua bước nhập mã. Sảnh chờ có khung hướng dẫn phím ngắn gọn.
