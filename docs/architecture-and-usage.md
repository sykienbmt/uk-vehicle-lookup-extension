# UK Vehicle Plate Lookup — Chrome Extension (Manifest V3)

Extension hỗ trợ tra cứu nhanh biển số xe Vương quốc Anh (UK VRN) tự động trên **GOV.UK (`vehicleenquiry.service.gov.uk`)** và **CarCheck (`www.carcheck.co.uk`)** + thông số kỹ thuật chi tiết ngay trong Popup hoặc Side Panel của Chrome mà không cần phải mở tab thủ công và dán đi dán lại.

## 1. Cấu trúc thư mục
- `manifest.json` — Cấu hình Chrome Extension Manifest V3 (`popup`, `sidePanel`, `contextMenus`, `storage`, `host_permissions`).
- `popup.html` & `styles/popup-styles.css` — Giao diện tra cứu biển số chuẩn UK (Popup & Side Panel).
- `src/utils/vrn-formatter.js` — Chuẩn hóa, kiểm tra định dạng biển số UK (`DN16FTK` ↔ `DN16 FTK`) và tạo chuỗi copy nhanh.
- `src/parsers/govuk-html-parser.js` — Bóc tách dữ liệu từ luồng 3 bước của `vehicleenquiry.service.gov.uk` (Tax, MOT, Make, Colour, Engine, CO₂, V5C date...).
- `src/parsers/carcheck-html-parser.js` — Bóc tách dữ liệu từ `carcheck.co.uk` và dữ liệu thông số kỹ thuật mở rộng (Model, Variant, Body Style, BHP, MPG, Top Speed, 0-60 MPH, Insurance Group, Tax Cost).
- `src/services/govuk-vehicle-service.js` — Tự động gửi request 3 bước (`GET /` → `POST /vehicle-enquiry/save` → `POST ConfirmVehicle=Yes`) tới GOV.UK DVLA.
- `src/services/carcheck-vehicle-service.js` — Truy vấn song song `www.carcheck.co.uk` và thông số kỹ thuật chi tiết của xe.
- `src/services/vehicle-lookup-coordinator.js` — Điều phối tra cứu song song (`Promise.all`) và gộp kết quả từ các nguồn.
- `src/services/storage-history-service.js` — Lưu lịch sử các biển số vừa tra cứu vào `chrome.storage.local` để mở lại tức thì.
- `src/content/govuk-autofill-content-script.js` — Content script tự động điền biển số và bấm `Continue` + `Yes` khi người dùng mở trang `vehicleenquiry.service.gov.uk` từ nút **Mở GOV.UK**.
- `src/background/service-worker.js` — Service worker xử lý menu chuột phải (**Tra cứu biển số xe UK**) và mở Side Panel.
- `src/popup/ui-renderer.js` & `src/popup/popup-controller.js` — Hiển thị kết quả và điều khiển tương tác người dùng.

## 2. Hướng dẫn cài đặt lên Google Chrome
1. Mở Chrome và truy cập: `chrome://extensions/`
2. Bật công tắc **Developer mode (Chế độ dành cho nhà phát triển)** ở góc trên bên phải.
3. Nhấn nút **Load unpacked (Tải tiện ích đã giải nén)** ở góc trên bên trái.
4. Chọn thư mục: `d:\extension\UK-vehicle extension`
5. Ghim (Pin) biểu tượng **UK Vehicle Plate Lookup** lên thanh công cụ Chrome.

## 3. Các cách sử dụng nhanh
- **Cách 1 (Dán trực tiếp trong Popup / Side Panel)**: Mở extension, nhấn `Ctrl + V` hoặc bấm nút **📋 Dán** — extension sẽ tự động chuẩn hóa biển số và tìm kiếm ngay lập tức (không cần bấm Enter).
- **Cách 2 (Bôi đen trên bất kỳ trang web nào)**: Bôi đen biển số xe (ví dụ `DN16FTK` trên Jira, iHub, Stella, email) → Chuột phải chọn **Tra cứu biển số xe UK: "DN16FTK"** → Thanh bên (Side Panel) sẽ tự mở và hiển thị kết quả.
- **Cách 3 (Mở trang gốc tự động điền)**: Nhấn **🏛️ Mở GOV.UK** (extension sẽ tự động điền biển số, tự bấm Continue & Yes để vào thẳng trang kết quả của GOV.UK) hoặc **🚗 Mở CarCheck** / **⚡ Mở cả 2**.

