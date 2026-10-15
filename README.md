# @quocandev27/rn_network_debugger

Thư viện debug cho React Native trên iOS và Android, dùng cùng [RN Network Viewer](https://github.com/DevMobileAn27/rn_network_viewer) để xem network request, response và console log trên macOS/Windows.

- [Cài đặt từ npm](https://www.npmjs.com/package/@quocandev27/rn_network_debugger)
- [Ứng dụng RN Network Viewer](https://github.com/DevMobileAn27/rn_network_viewer)
- [Source thư viện](https://github.com/DevMobileAn27/rn_network_debugger)

## Yêu cầu

- React Native **0.74 trở lên**, iOS hoặc Android.
- Chạy trong môi trường development/debug.
- Máy tính có RN Network Viewer và thiết bị có thể kết nối tới máy tính đó.

Thư viện thu thập các request qua `fetch` và `XMLHttpRequest` trong JavaScript, cùng `console.log`, `info`, `warn`, `error`, `debug`. Axios dùng adapter XHR cũng được thu thập. Request do thư viện native gọi trực tiếp không nằm trong phạm vi này.

## Cài đặt

Trong dự án React Native:

```sh
yarn add @quocandev27/rn_network_debugger
```

Hoặc dùng npm:

```sh
npm install @quocandev27/rn_network_debugger
```

Với iOS, chạy trong thư mục `ios`:

```sh
pod install
```

Sau khi cài, build lại app native; chỉ Reload JavaScript chưa đủ để thêm native module.

## Bắt đầu nhanh

Thêm vào file khởi chạy, trước `AppRegistry.registerComponent`:

```ts
import {bootRNNetworkDebuggerWithPort} from '@quocandev27/rn_network_debugger';

if (__DEV__) {
  bootRNNetworkDebuggerWithPort(38940);
}
```

1. Mở RN Network Viewer, kiểm tra trạng thái **Listening :38940**.
2. Build và chạy app React Native ở chế độ development.
3. Gọi API hoặc ghi console log trong app.
4. Chọn **Network** hoặc **Console** ở Viewer để xem dữ liệu. Dùng tab ứng dụng để lọc khi có nhiều app kết nối.

Giữ khởi tạo trong `if (__DEV__)` để chỉ bật capture ở môi trường phát triển. Chỉ chọn một cách khởi tạo trong các ví dụ dưới đây.

## Chọn địa chỉ và cổng

Khi không chỉ định host, SDK lấy địa chỉ máy chạy Metro nếu có; nếu không, dùng `127.0.0.1` trên iOS hoặc `10.0.2.2` trên Android. Nếu Viewer chạy ở máy khác Metro, hoặc địa chỉ tự chọn không kết nối được, chỉ định `VIEWER_HOST`:

```ts
import {bootRNNetworkDebugger} from '@quocandev27/rn_network_debugger';

if (__DEV__) {
  bootRNNetworkDebugger({
    VIEWER_HOST: '192.168.1.10',
    VIEWER_PORT: 38940,
  });
}
```

| Môi trường | `VIEWER_HOST` |
| --- | --- |
| iOS Simulator, Viewer trên cùng máy Mac | `127.0.0.1` |
| Android Emulator, Viewer trên cùng máy tính | `10.0.2.2` |
| Điện thoại qua Wi-Fi | IP LAN của máy tính chạy Viewer |
| Android qua USB | `127.0.0.1`, sau khi chạy `adb reverse` |

Android qua USB:

```sh
adb reverse tcp:38940 tcp:38940
```

Nếu nhiều thiết bị Android đang kết nối, dùng `adb -s <device-id> reverse tcp:38940 tcp:38940`.

Với Wi-Fi, kết nối điện thoại và máy tính vào cùng mạng. Nhấn **?** trong Viewer để xem địa chỉ máy tính. Khi đổi cổng ở **Settings → WebSocket port**, đổi `VIEWER_PORT` và lệnh `adb reverse` tương ứng, rồi Reload app.

SDK chọn host từ cấu hình hoặc Metro; không tự quét mạng LAN để tìm Viewer.

## Cấu hình capture

Có thể truyền trực tiếp vào `bootRNNetworkDebugger`, hoặc lưu cấu hình trong file riêng:

```ts
// src/devtools/rnNetworkDebugger.config.ts
import {defineRNNetworkDebuggerConfig} from '@quocandev27/rn_network_debugger';

export default defineRNNetworkDebuggerConfig({
  VIEWER_PORT: 38940,
  CAPTURE_FETCH: true,
  CAPTURE_XML_HTTP_REQUEST: true,
  CAPTURE_CONSOLE: true,
  MAX_BODY_PREVIEW_CHARACTERS: 2048,
  MAX_BODY_CAPTURE_CHARACTERS: null,
});
```

Trong file khởi chạy:

```ts
import {bootRNNetworkDebugger} from '@quocandev27/rn_network_debugger';
import config from './src/devtools/rnNetworkDebugger.config';

if (__DEV__) {
  bootRNNetworkDebugger(config);
}
```

| Tùy chọn | Mặc định | Cách dùng |
| --- | --- | --- |
| `VIEWER_HOST` | Host của Metro, hoặc địa chỉ dự phòng theo platform | IP/hostname của máy chạy Viewer |
| `VIEWER_PORT` | `38940` | Trùng với WebSocket port của Viewer |
| `VIEWER_PATH` | `/rnv/network` | Đường dẫn kết nối tới Viewer |
| `VIEWER_URL` | Không đặt | URL đầy đủ, được ưu tiên hơn host/port/path |
| `CAPTURE_FETCH` | `true` | Thu thập request từ `fetch` |
| `CAPTURE_XML_HTTP_REQUEST` | `true` | Thu thập request từ `XMLHttpRequest` |
| `CAPTURE_CONSOLE` | `true` | Thu thập console log |
| `MAX_BODY_PREVIEW_CHARACTERS` | `2048` | Giới hạn phần body preview |
| `MAX_BODY_CAPTURE_CHARACTERS` | `null` | Giới hạn body gửi sang Viewer; `null` không tự cắt theo số ký tự |
| `MASK_HEADERS` | `authorization`, `cookie`, `set-cookie`, `x-access-token` | Danh sách tên header cần che giá trị |
| `MAX_BATCH_SIZE` | `20` | Số event để gửi một batch |
| `FLUSH_INTERVAL_MS` | `150` | Khoảng thời gian gửi các event đang chờ, tính bằng ms |

Cấu hình cũng nhận tên camelCase tương ứng, ví dụ `viewerHost`, `viewerPort`, `captureConsole`. Nên dùng thống nhất một kiểu tên trong cùng cấu hình.

Để giới hạn body và bổ sung header cần che:

```ts
import {
  bootRNNetworkDebugger,
  DEFAULT_MASK_HEADERS,
} from '@quocandev27/rn_network_debugger';

if (__DEV__) {
  bootRNNetworkDebugger({
    VIEWER_PORT: 38940,
    MAX_BODY_CAPTURE_CHARACTERS: 100000,
    MASK_HEADERS: [...DEFAULT_MASK_HEADERS, 'x-api-key'],
  });
}
```

`MASK_HEADERS` thay thế danh sách mặc định, nên thêm `DEFAULT_MASK_HEADERS` nếu muốn giữ các mục sẵn có. Tùy chọn này che header, không che dữ liệu trong body hoặc console log. Dù SDK không giới hạn ký tự body, Viewer vẫn có giới hạn dung lượng và số bản ghi được giữ.

## Dừng capture

Nếu khởi tạo bằng `bootRNNetworkDebugger` hoặc `bootRNNetworkDebuggerWithPort`:

```ts
import {stopRNNetworkDebuggerBootstrap} from '@quocandev27/rn_network_debugger';

stopRNNetworkDebuggerBootstrap();
```

Có thể gọi lại hàm `boot` để khởi tạo với cấu hình mới.

## Điều khiển trực tiếp

Nếu cần tự quản lý vòng đời, dùng `startRNNetworkDebugger` thay cho `boot`:

```ts
import {
  startRNNetworkDebugger,
  stopRNNetworkDebugger,
} from '@quocandev27/rn_network_debugger';

if (__DEV__) {
  const controller = startRNNetworkDebugger({
    viewerURL: 'ws://127.0.0.1:38940/rnv/network',
    captureFetch: true,
    captureXMLHttpRequest: true,
    captureConsole: true,
  });

  // Khi cần dừng:
  // controller.stop();
  // Hoặc stopRNNetworkDebugger();
}
```

Thay địa chỉ trong `viewerURL` theo thiết bị như bảng ở trên. API này dùng tên tùy chọn camelCase.

Các API bổ sung có khai báo TypeScript trong package: `createRNNetworkDebuggerController`, `addRNNetworkDebuggerListener`, `defineRNNetworkDebuggerConfig`, `normalizeRNNetworkDebuggerConfig`, `resolveRNNetworkDebuggerViewerHost` và `resolveRNNetworkDebuggerViewerURL`. Các alias `RNVNetworkCapture` cũ vẫn được giữ để tương thích.

## Sử dụng với AI qua MCP

MCP được bật trong **RN Network Viewer**, không cần thêm cấu hình MCP vào app React Native:

1. Kết nối app với Viewer và kiểm tra đã có request hoặc log.
2. Trong Viewer, mở **Settings → MCP** và bật công tắc. MCP mặc định tắt, dùng cổng riêng `38941`.
3. Bấm **Copy setup command** rồi dán vào AI để thiết lập client. Mũi tên cạnh nút có cấu hình JSON và Codex.
4. Yêu cầu AI xem request lỗi, phân tích response hoặc tìm console error.

Client AI cần hỗ trợ MCP cục bộ trên cùng máy tính với Viewer. ChatGPT web/cloud không truy cập trực tiếp được endpoint localhost. MCP chỉ đọc dữ liệu hiện được Viewer giữ. Xem hướng dẫn chi tiết tại [RN Network Viewer](https://github.com/DevMobileAn27/rn_network_viewer).

## Xử lý sự cố

| Hiện tượng | Kiểm tra |
| --- | --- |
| Không thấy ứng dụng hoặc dữ liệu | Viewer đang Listening, app là bản development, SDK đã được khởi tạo trước thao tác cần theo dõi |
| Native module không tìm thấy | Chạy `pod install` cho iOS và build lại app native sau khi cài package |
| Emulator không kết nối | Kiểm tra host: iOS `127.0.0.1`, Android `10.0.2.2`; hoặc chỉ định host đúng môi trường |
| Android USB không kết nối | Chạy `adb reverse`, đặt host `127.0.0.1`, kiểm tra cổng hai bên trùng nhau |
| Thiết bị thật không kết nối | Dùng IP LAN của máy chạy Viewer, cùng mạng Wi-Fi, kiểm tra quyền Local Network/firewall |
| Không thấy một số request | SDK chỉ thu thập `fetch`/XHR trong JS; khởi tạo trước khi gọi API và kiểm tra bộ lọc/Pause trong Viewer |
| Body bị thiếu | Kiểm tra `MAX_BODY_CAPTURE_CHARACTERS`; phân biệt phần body đầy đủ với phần preview |

## Giấy phép

Apache-2.0. Xem [LICENSE](LICENSE).
