# Thiết kế hệ thống bảng giao dịch

## Mục tiêu

Làm lại bảng Giao dịch và Giao dịch định kỳ để thao tác nhanh, nhất quán trên
desktop/mobile, giữ trạng thái lọc/sort khi reload, và hỗ trợ xoá an toàn.

## Phạm vi

- Bảng Giao dịch: menu hành động, xác nhận xoá, hoàn tác, bulk actions,
  checkbox, sort có chỉ báo, trạng thái đầy đủ, empty state.
- Bảng Giao dịch định kỳ: cột hành động mới, toggle bật/tắt tại chỗ, menu
  cùng chuẩn với bảng Giao dịch.
- Responsive: desktop dùng table; dưới 768px dùng card list.
- Query state: lưu filter, sort và trang hiện tại trong query của hash route.
- Không thay đổi backend contract; bổ sung dữ liệu trạng thái và helper CRUD
  nếu cần để dùng chung với localStorage/Supabase adapter.

## Kiến trúc

Giữ hai feature view riêng vì bảng giao dịch và định kỳ có schema khác nhau.
Tách các phần dùng chung thành helper UI nhỏ:

- Action menu markup và icon/ARIA conventions.
- Confirmation modal và detail modal được tạo theo từng view khi cần.
- Status badge hỗ trợ `pending`, `completed`, `failed`, `cancelled`.
- Query-state helper mã hoá/giải mã filter, sort, page; chỉ ghi các giá trị
  hợp lệ và giữ query khi router render lại.

Selection là state cục bộ của từng view, reset khi dữ liệu thay đổi hoặc khi
điều hướng. Bulk bar chỉ xuất hiện khi có ít nhất một hàng được chọn. Tất cả
handler dùng event delegation trên container để không bị nhân bản listener sau
render.

## Luồng hành động

### Menu hàng

Mỗi hàng có menu ba chấm với:

1. Xem chi tiết — modal read-only hiển thị toàn bộ trường.
2. Sửa — mở form giao dịch hiện có với dữ liệu prefill.
3. Nhân bản — mở form tạo mới với dữ liệu sao chép nhưng id mới.
4. Xoá — mở confirmation modal; không dùng `window.confirm`.

Menu hiển thị rõ khi hover trên desktop, luôn hiển thị trên mobile, có
keyboard focus và đóng khi click ngoài/Escape.

### Xoá và hoàn tác

Sau khi xác nhận, lưu snapshot của bản ghi/bản ghi đã xoá, xoá qua
`dataService`, emit `data:changed`, rồi hiển thị toast chính xác
`Đã xoá giao dịch` với nút `Hoàn tác` trong 5 giây. Hoàn tác khôi phục snapshot
qua API add/update tương ứng và chỉ thực hiện một lần. Bulk delete dùng cùng
luồng nhưng thông báo số lượng phù hợp.

### Bulk actions

Checkbox đầu bảng chọn/bỏ chọn toàn bộ các hàng đang hiển thị. Thanh nổi gồm:
`Xoá đã chọn`, `Đổi danh mục`, `Xuất CSV`. Đổi danh mục dùng select/modal nhỏ,
chỉ commit khi người dùng xác nhận. CSV chỉ chứa các hàng được chọn khi bulk
bar đang active; export ở page header vẫn xuất toàn bộ dữ liệu đã lọc.

### Giao dịch định kỳ

Cột Hành động bổ sung menu tương tự, và cột/trạng thái active có toggle tại
chỗ. Toggle gọi `updateRecurring(id, { status })`, cập nhật KPI và hiển thị
toast lỗi nếu persistence thất bại.

## Sort, filter và URL

Các cột có nghĩa được sort: Người thu/Tên, Danh mục, Ngày/Ngày tiếp theo,
Số tiền; recurring thêm Tần suất và Trạng thái nếu phù hợp. Header có mũi tên
`↑`/`↓`, `aria-sort`, và sort ổn định. Search/type/category/month/status được
đọc từ `URLSearchParams`; mọi thay đổi filter/sort cập nhật query mà không
đổi route. Reload hoặc back/forward khôi phục đúng state. Page được reset về 1
khi filter/sort thay đổi.

## Trạng thái

Transaction status chuẩn hoá:

- `pending` — Đang chờ, màu vàng.
- `completed` — Hoàn thành, màu xanh.
- `failed` — Thất bại, màu đỏ.
- `cancelled` — Đã huỷ, màu xám.

Dữ liệu cũ không có hoặc có giá trị lạ được hiển thị là `completed` để giữ
backward compatibility; form chỉnh sửa chỉ ghi các giá trị chuẩn.

## Empty state và responsive

Empty state có minh hoạ CSS/SVG, thông điệp theo nguyên nhân và CTA:
`Thêm giao dịch` khi chưa có dữ liệu, `Xoá bộ lọc` khi filter không có kết quả.
Desktop table có zebra rất nhẹ, hover highlight, sticky header khi cuộn.
Dưới 768px, ẩn table và render card list; mỗi card có icon + tên + danh mục +
ngày ở trái, số tiền ở phải, cùng selection/action affordance.

## Error handling và kiểm thử

Lỗi từ data service không bị nuốt: log qua error boundary hiện có và hiển thị
toast lỗi. Kiểm thử smoke/Puppeteer cần bao phủ menu, modal xoá, undo timeout,
selection/bulk, URL restore, sort indicators, recurring toggle và mobile card
layout. Kiểm tra syntax/module load trước khi chạy smoke.
