# @quocandev27/rn_network_debugger

Thư viện debug cho React Native trên iOS và Android, dùng cùng [RN Network Viewer](https://github.com/DevMobileAn27/rn_network_viewer) để xem network request, response và console log trên macOS/Windows.

- [→ Xem package trên npm](https://www.npmjs.com/package/@quocandev27/rn_network_debugger)
- [→ Mở dự án RN Network Viewer trên GitHub](https://github.com/DevMobileAn27/rn_network_viewer)
- [→ Xem mã nguồn thư viện trên GitHub](https://github.com/DevMobileAn27/rn_network_debugger)

## Yêu cầu

- React Native **0.74 trở lên**, iOS hoặc Android.
- Chạy trong môi trường development/debug.
- Máy tính có RN Network Viewer và thiết bị có thể kết nối tới máy tính đó.

Với React Native **dưới 0.74**, bạn có thể dùng [Flipper](https://fbflipper.com/) để debug network và log, tùy cấu hình dự án. Từ React Native 0.74, tích hợp Flipper mặc định đã được gỡ khỏi template dự án mới.

Thư viện thu thập các request qua `fetch` và `XMLHttpRequest` trong JavaScript, cùng `console.log`, `info`, `warn`, `error`, `debug`. Axios dùng adapter XHR cũng được thu thập. Request do thư viện native gọi trực tiếp không nằm trong phạm vi này.

## Quick install with AI prompt

Copy this prompt into your AI coding agent in your React Native project:

```text
Install and set up @quocandev27/rn_network_debugger as a devDependency using this project's package manager. Follow https://github.com/DevMobileAn27/rn_network_debugger#readme. Initialize only inside __DEV__ using Copy SDK setup from Viewer Settings → Security; keep the pairing token out of Git, run pod install for iOS, and verify the development build. Check how to exclude the SDK from release builds; devDependencies alone is not enough. Make the changes, run the necessary commands, and summarize the results.
```

## Cài đặt

Trong dự án React Native, cài vào `devDependencies`:

```sh
yarn add -D @quocandev27/rn_network_debugger
```

Hoặc dùng npm:

```sh
npm install --save-dev @quocandev27/rn_network_debugger
```

Với iOS, chạy trong thư mục `ios`:

```sh
pod install
```

Sau khi cài, build lại app native; chỉ Reload JavaScript chưa đủ để thêm native module.

`devDependencies` không tự loại SDK khỏi APK/IPA. Để bản release không chứa SDK, cần loại cả import JavaScript và native linking khỏi build release.

## Bắt đầu nhanh

1. Mở RN Network Viewer → **Settings → Security → Copy SDK setup**.
2. Dán cấu hình vào entry point trước `AppRegistry.registerComponent`, giữ khối `if (__DEV__)`. Cấu hình có token riêng: lưu trong file local được Git ignore.
3. Build và chạy app ở chế độ development, gọi API hoặc ghi console log.
4. Chọn **Network** hoặc **Console** trong Viewer.

Viewer mặc định chỉ nhận kết nối localhost. Android USB dùng `adb reverse tcp:38940 tcp:38940`; Android Emulator đổi host trong `VIEWER_URL` thành `10.0.2.2`. Với điện thoại qua Wi-Fi, bật LAN trong Viewer, chọn IP/subnet rồi copy lại setup. Xem [→ Hướng dẫn kết nối Viewer](https://github.com/DevMobileAn27/rn_network_viewer#readme).

Kết nối yêu cầu pairing token, có sẵn trong cấu hình **Copy SDK setup** của Viewer.

SDK mặc định che dữ liệu nhạy cảm và giới hạn capture. Để thay đổi, mở **Settings → Security** trong Viewer, bật/tắt **Redact sensitive data** hoặc **Limit capture**, bấm **Apply & restart**, rồi copy lại SDK setup và reload app. Xem [→ Hướng dẫn bảo mật](docs/security.md).

## Sử dụng với AI qua MCP

RN Network Viewer hỗ trợ MCP để AI đọc request, response và console log. Bật **Settings → MCP** trong Viewer, rồi bấm **Copy setup command** để thiết lập client AI. MCP mặc định tắt; không cần cấu hình thêm trong SDK.

## Kiểm chứng

[Chính sách bảo mật](SECURITY.md) · [Kiểm thử và phạm vi tương thích](docs/verification.md) · [Workflow CI](.github/workflows/checks.yml). Dự án chưa có kiểm toán bảo mật độc lập.

## Giấy phép

Apache-2.0. Xem [LICENSE](LICENSE).
