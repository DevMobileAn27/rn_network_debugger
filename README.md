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
Install and set up @quocandev27/rn_network_debugger as a devDependency using this project's package manager. Follow https://github.com/DevMobileAn27/rn_network_debugger#readme. Initialize only inside __DEV__, connect to RN Network Viewer on port 38940, run pod install for iOS, and verify the development build. Check how to exclude the SDK from release builds; devDependencies alone is not enough. Make the changes, run the necessary commands, and summarize the results.
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

Thêm vào file khởi chạy, trước `AppRegistry.registerComponent`:

```ts
if (__DEV__) {
  const {bootRNNetworkDebuggerWithPort} = require('@quocandev27/rn_network_debugger');
  bootRNNetworkDebuggerWithPort(38940);
}
```

1. Mở RN Network Viewer, kiểm tra trạng thái **Listening :38940**.
2. Build và chạy app React Native ở chế độ development.
3. Gọi API hoặc ghi console log trong app.
4. Chọn **Network** hoặc **Console** ở Viewer để xem dữ liệu. Dùng tab ứng dụng để lọc khi có nhiều app kết nối.

SDK mặc định dùng địa chỉ máy chạy Metro để kết nối. Nếu chưa thấy dữ liệu, xem [→ Hướng dẫn kết nối và sử dụng Viewer](https://github.com/DevMobileAn27/rn_network_viewer#readme).

## Sử dụng với AI qua MCP

RN Network Viewer hỗ trợ MCP để AI đọc request, response và console log. Bật **Settings → MCP** trong Viewer, rồi bấm **Copy setup command** để thiết lập client AI. MCP mặc định tắt; không cần cấu hình thêm trong SDK.

## Giấy phép

Apache-2.0. Xem [LICENSE](LICENSE).
