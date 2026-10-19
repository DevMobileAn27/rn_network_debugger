# @quocandev27/rn_network_debugger

## 1. Giới thiệu

Thư viện giúp xem network request, response và console log của app React Native trên RN Network Viewer (macOS/Windows). Hỗ trợ `fetch`, `XMLHttpRequest` và Axios dùng adapter XHR; không thu thập request do thư viện native gọi trực tiếp.

- [**Bấm vào để xem package trên npm**](https://www.npmjs.com/package/@quocandev27/rn_network_debugger)
- [**Bấm vào để xem và tải RN Network Viewer**](https://github.com/DevMobileAn27/rn_network_viewer)
- [**Bấm vào để xem mã nguồn thư viện**](https://github.com/DevMobileAn27/rn_network_debugger)

## 2. Yêu cầu

- React Native **0.74 trở lên**, iOS hoặc Android.
- Chạy trong môi trường development/debug.
- Máy tính có RN Network Viewer và thiết bị có thể kết nối tới máy tính đó.

Với React Native **dưới 0.74**, bạn có thể dùng [**Flipper (Bấm vào để xem dự án Flipper)**](https://fbflipper.com/) để debug network và log, tùy cấu hình dự án. Từ React Native 0.74, tích hợp Flipper mặc định đã được gỡ khỏi template dự án mới.

## 3. Cài nhanh thư viện với prompt AI

Copy prompt sau vào AI trong dự án React Native:

```text
Install @quocandev27/rn_network_debugger as a devDependency with this project's package manager. Follow https://github.com/DevMobileAn27/rn_network_debugger#readme. Create a dev-only init function using Viewer → Settings → Security → Copy SDK setup; keep the token out of Git. Run pod install for iOS, rebuild, and verify network/log capture. Check release exclusion; devDependencies alone is not enough.
```

## 4. Cài đặt thủ công

Chọn lệnh theo package manager của dự án:

```sh
yarn add -D @quocandev27/rn_network_debugger
```

```sh
npm install --save-dev @quocandev27/rn_network_debugger
```

Với iOS, chạy thêm trong thư mục `ios`:

```sh
pod install
```

`devDependencies` không tự loại SDK khỏi APK/IPA. Giữ SDK trong `__DEV__`; nếu cần loại hoàn toàn khỏi release, xem [hướng dẫn release](docs/security.md#release-builds).

## 5. Tạo hàm init

Tạo file **`src/dev/initNetworkDebugger.local.js`**. Lấy URL, token và tùy chọn từ **Viewer → Settings → Security → Copy SDK setup** để thay vào ví dụ:

```js
export function initNetworkDebugger() {
  if (!__DEV__) return;

  const {bootRNNetworkDebugger} = require('@quocandev27/rn_network_debugger');

  return bootRNNetworkDebugger({
    VIEWER_URL: 'ws://127.0.0.1:38940/rnv/network',
    VIEWER_TOKEN: 'PASTE_TOKEN_FROM_VIEWER',
    REDACT_SENSITIVE_DATA: true,
    LIMIT_CAPTURE: true,
  });
}
```

Thêm file chứa token vào **`.gitignore`**:

```gitignore
src/dev/initNetworkDebugger.local.js
```

Gọi hàm trong **`index.js`**, trước khi nạp `App` và đăng ký component:

```js
if (__DEV__) {
  require('./src/dev/initNetworkDebugger.local').initNetworkDebugger();
}

const {AppRegistry} = require('react-native');
const App = require('./App').default;
const {name: appName} = require('./app.json');

AppRegistry.registerComponent(appName, () => App);
```

Giữ đường dẫn `App` và tên component theo dự án của bạn.

- **iOS Simulator:** dùng host `127.0.0.1` khi Viewer chạy trên cùng máy Mac.
- **Android USB:** chạy `adb reverse tcp:38940 tcp:38940`, giữ host `127.0.0.1`.
- **Android Emulator:** đổi host thành `10.0.2.2`.
- **Điện thoại qua Wi-Fi:** bật LAN trong Viewer, chọn IP/subnet, **Apply & restart** rồi copy lại setup.

SDK mặc định che dữ liệu nhạy cảm và giới hạn capture. Muốn bật/tắt, đổi **Redact sensitive data / Limit capture** trong Viewer, **Apply & restart**, copy lại setup rồi reload app.

## 6. Kiểm chứng và Giấy phép

Build lại app ở chế độ development/debug sau khi cài SDK; chỉ reload JavaScript chưa đủ. Gọi một API và `console.log('Debugger connected')`, rồi kiểm tra tab **Network** và **Console** trong Viewer.

[Kiểm thử và tương thích](docs/verification.md) · [Bảo mật](SECURITY.md) · [Workflow CI](.github/workflows/checks.yml). Dự án chưa có kiểm toán bảo mật độc lập.

Giấy phép **Apache-2.0** — xem [LICENSE](LICENSE).
