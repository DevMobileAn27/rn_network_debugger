# `@quocandev27/rn_network_debugger`

## Giới thiệu

`rn_network_debugger` là SDK dev-only cho React Native, dùng để capture:

- `fetch`
- `XMLHttpRequest`
- `console.log`
- `console.info`
- `console.warn`
- `console.error`
- `console.debug`

SDK này được thiết kế để gửi dữ liệu debug sang app [React Native Viewer](https://github.com/DevMobileAn27/React-Native-Viewer).

Hiện tại cả SDK và app Viewer vẫn đang trong quá trình test và phát triển, nên chỉ nên dùng trong môi trường `dev/debug`.

GitHub SDK: https://github.com/DevMobileAn27/rn_network_debugger

## Phạm vi React Native Version

- `peerDependencies`: `react-native >= 0.74`
- Phạm vi sử dụng hiện tại nên hiểu là `React Native 0.74+`
- Các version thấp hơn `0.74` hiện chưa được package này cam kết hỗ trợ

## Cách Dùng

### 1. Cài package

```bash
npm install @quocandev27/rn_network_debugger
```

hoặc

```bash
yarn add @quocandev27/rn_network_debugger
```

### 2. Dùng nhanh nhất bằng port

```ts
import {bootRNNetworkDebuggerWithPort} from '@quocandev27/rn_network_debugger';

if (__DEV__) {
  bootRNNetworkDebuggerWithPort(38940);
}
```

### 3. Dùng qua config

```ts
// src/devtools/rnNetworkDebugger.config.ts
import {
  DEFAULT_VIEWER_PORT,
  defineRNNetworkDebuggerConfig,
} from '@quocandev27/rn_network_debugger';

export default defineRNNetworkDebuggerConfig({
  VIEWER_PORT: DEFAULT_VIEWER_PORT,
  CAPTURE_FETCH: true,
  CAPTURE_XML_HTTP_REQUEST: true,
  CAPTURE_CONSOLE: true,
});
```

```ts
import {bootRNNetworkDebugger} from '@quocandev27/rn_network_debugger';
import rnNetworkDebuggerConfig from './src/devtools/rnNetworkDebugger.config';

if (__DEV__) {
  bootRNNetworkDebugger(rnNetworkDebuggerConfig);
}
```

### 4. Start thủ công

```ts
import {startRNNetworkDebugger} from '@quocandev27/rn_network_debugger';

const controller = startRNNetworkDebugger({
  viewerURL: 'ws://127.0.0.1:38940/rnv/network',
  captureFetch: true,
  captureXMLHttpRequest: true,
  captureConsole: true,
});
```

### 5. Stop khi cần

```ts
import {
  stopRNNetworkDebugger,
  stopRNNetworkDebuggerBootstrap,
} from '@quocandev27/rn_network_debugger';

stopRNNetworkDebugger();
stopRNNetworkDebuggerBootstrap();
```

## Các Action Sẵn Có

### Bootstrap / start / stop

- `bootRNNetworkDebugger(config)`
- `bootRNNetworkDebuggerWithPort(viewerPort, overrides?)`
- `startRNNetworkDebugger(options)`
- `stopRNNetworkDebugger()`
- `stopRNNetworkDebuggerBootstrap()`

### Controller / listener

- `createRNNetworkDebuggerController(options)`
- `addRNNetworkDebuggerListener(listener)`

### Config / resolve helper

- `defineRNNetworkDebuggerConfig(config)`
- `normalizeRNNetworkDebuggerConfig(config)`
- `resolveRNNetworkDebuggerViewerHost(input?)`
- `resolveRNNetworkDebuggerViewerURL(input?)`

### Alias cũ vẫn có thể dùng

- `bootRNVNetworkCapture`
- `bootRNVNetworkCaptureWithPort`
- `startRNVNetworkCapture`
- `stopRNVNetworkCapture`
- `stopRNVNetworkCaptureBootstrap`
- `createRNVNetworkCaptureController`
- `addRNVNetworkListener`
- `resolveRNVViewerHost`
- `resolveRNVViewerURL`

## Ghi Chú

- SDK tự resolve host từ Metro khi có thể
- iOS fallback về `127.0.0.1`
- Android emulator fallback về `10.0.2.2`
- Viewer ingest mặc định là `ws://<host>:38940/rnv/network`
- `console` được capture dưới dạng structured JSON-safe để Viewer có thể render object đầy đủ hơn
- `maxBodyPreviewCharacters` chỉ giới hạn phần preview
- `maxBodyCaptureCharacters` giới hạn phần body đầy đủ gửi sang Viewer
- Mặc định `maxBodyCaptureCharacters = null`, tức là SDK không tự cắt full body
- SDK này không phải HTTP proxy, nên chỉ capture các request đi qua `fetch` và `XMLHttpRequest` trong JS runtime
- Không nên include package này trong build release/production
