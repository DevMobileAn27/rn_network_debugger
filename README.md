# `@quocandev27/rn_network_debugger`

Thư viện debug dành cho React Native, dùng để bắt `fetch` và `XMLHttpRequest` rồi gửi log network sang `React Native Viewer`.

Package này chỉ nên dùng trong môi trường dev/debug.

GitHub: https://github.com/DevMobileAn27/rn_network_debugger

## Cách sử dụng

### 1. Cài package

```bash
npm install @quocandev27/rn_network_debugger
```

hoặc

```bash
yarn add @quocandev27/rn_network_debugger
```

### 2. Cách nhanh nhất: boot trực tiếp bằng port

```ts
import {bootRNNetworkDebuggerWithPort} from '@quocandev27/rn_network_debugger';

if (__DEV__) {
  bootRNNetworkDebuggerWithPort(38940);
}
```

### 3. Nếu muốn, vẫn có thể dùng file config

```ts
// src/devtools/rnNetworkDebugger.config.ts
import {
  DEFAULT_VIEWER_PORT,
  defineRNNetworkDebuggerConfig,
} from '@quocandev27/rn_network_debugger';

export default defineRNNetworkDebuggerConfig({
  VIEWER_PORT: DEFAULT_VIEWER_PORT,
});
```

```ts
import {bootRNNetworkDebugger} from '@quocandev27/rn_network_debugger';
import rnNetworkDebuggerConfig from './src/devtools/rnNetworkDebugger.config';

if (__DEV__) {
  bootRNNetworkDebugger(rnNetworkDebuggerConfig);
}
```

### 4. Dừng debugger nếu cần

```ts
import {stopRNNetworkDebuggerBootstrap} from '@quocandev27/rn_network_debugger';

stopRNNetworkDebuggerBootstrap();
```

## Ghi chú

- Thư viện tự resolve host từ Metro khi có thể.
- iOS sẽ fallback về `127.0.0.1`.
- Android emulator sẽ fallback về `10.0.2.2`.
- Viewer ingest mặc định là `ws://<host>:38940/rnv/network`.

## API chính

- `defineRNNetworkDebuggerConfig`
- `bootRNNetworkDebugger`
- `bootRNNetworkDebuggerWithPort`
- `stopRNNetworkDebuggerBootstrap`
- `startRNNetworkDebugger`
- `stopRNNetworkDebugger`
