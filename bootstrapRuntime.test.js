const test = require('node:test');
global.__DEV__ = true;
const assert = require('node:assert/strict');

const {
  DEFAULT_MAX_BODY_CAPTURE_CHARACTERS,
  DEFAULT_MASK_HEADERS,
  DEFAULT_VIEWER_PATH,
  DEFAULT_VIEWER_PORT,
  createRNNetworkDebuggerBootstrapRuntime,
  resolveRNNetworkDebuggerViewerHost,
  resolveRNNetworkDebuggerViewerURL,
} = require('./bootstrapRuntime');

test('resolveRNNetworkDebuggerViewerHost prefers the Metro host from SourceCode.scriptURL', () => {
  assert.equal(
    resolveRNNetworkDebuggerViewerHost({
      platform: 'android',
      scriptURL:
        'http://192.168.1.12:8081/index.bundle?platform=android&dev=true',
    }),
    '192.168.1.12'
  );
});

test('resolveRNNetworkDebuggerViewerURL uses the configured VIEWER_PORT and default ingest path', () => {
  assert.equal(
    resolveRNNetworkDebuggerViewerURL({
      platform: 'ios',
      scriptURL: null,
      config: {
        VIEWER_PORT: 49000,
      },
    }),
    `ws://127.0.0.1:49000${DEFAULT_VIEWER_PATH}`
  );
});

test('createRNNetworkDebuggerBootstrapRuntime boots capture with resolved viewerURL and default mask headers', () => {
  const started = [];
  const stopped = [];
  const globalObject = {};

  const runtime = createRNNetworkDebuggerBootstrapRuntime({
    getPlatform: () => 'android',
    getScriptURL: () =>
      'http://10.11.12.13:8081/index.bundle?platform=android&dev=true',
    getGlobalObject: () => globalObject,
    startCapture: (options) => {
      started.push(options);
      return {
        stop() {
          stopped.push('current');
        },
      };
    },
  });

  const controller = runtime.bootRNNetworkDebugger({
    VIEWER_PORT: DEFAULT_VIEWER_PORT,
  });

  assert.ok(controller);
  assert.deepEqual(started, [
    {
      viewerURL: `ws://10.11.12.13:${DEFAULT_VIEWER_PORT}${DEFAULT_VIEWER_PATH}`,
      maxBodyCaptureCharacters: DEFAULT_MAX_BODY_CAPTURE_CHARACTERS,
      maxBodyPreviewCharacters: 2048,
      maskHeaders: DEFAULT_MASK_HEADERS,
      viewerToken: '',
      captureBodies: true,
      redactSensitiveData: true,
      limitCapture: true,
      redactKeys: [],
    },
  ]);

  runtime.stopRNNetworkDebuggerBootstrap();

  assert.deepEqual(stopped, ['current']);
});

test('createRNNetworkDebuggerBootstrapRuntime can boot directly from a viewer port without a config file', () => {
  const started = [];

  const runtime = createRNNetworkDebuggerBootstrapRuntime({
    getPlatform: () => 'ios',
    getScriptURL: () =>
      'http://192.168.0.50:8081/index.bundle?platform=ios&dev=true',
    getGlobalObject: () => ({}),
    startCapture: (options) => {
      started.push(options);
      return {stop() {}};
    },
  });

  runtime.bootRNNetworkDebuggerWithPort(49001);

  assert.deepEqual(started, [
    {
      viewerURL: `ws://192.168.0.50:49001${DEFAULT_VIEWER_PATH}`,
      maxBodyCaptureCharacters: DEFAULT_MAX_BODY_CAPTURE_CHARACTERS,
      maxBodyPreviewCharacters: 2048,
      maskHeaders: DEFAULT_MASK_HEADERS,
      viewerToken: '',
      captureBodies: true,
      redactSensitiveData: true,
      limitCapture: true,
      redactKeys: [],
    },
  ]);
});

test('createRNNetworkDebuggerBootstrapRuntime passes through maxBodyCaptureCharacters override', () => {
  const started = [];

  const runtime = createRNNetworkDebuggerBootstrapRuntime({
    getPlatform: () => 'ios',
    getScriptURL: () =>
      'http://192.168.0.50:8081/index.bundle?platform=ios&dev=true',
    getGlobalObject: () => ({}),
    startCapture: (options) => {
      started.push(options);
      return {stop() {}};
    },
  });

  runtime.bootRNNetworkDebugger({
    VIEWER_PORT: 49001,
    MAX_BODY_CAPTURE_CHARACTERS: 65536,
  });

  assert.deepEqual(started, [
    {
      viewerURL: `ws://192.168.0.50:49001${DEFAULT_VIEWER_PATH}`,
      maxBodyCaptureCharacters: 65536,
      maxBodyPreviewCharacters: 2048,
      maskHeaders: DEFAULT_MASK_HEADERS,
      viewerToken: '',
      captureBodies: true,
      redactSensitiveData: true,
      limitCapture: true,
      redactKeys: [],
    },
  ]);
});

test('createRNNetworkDebuggerBootstrapRuntime passes through captureConsole override', () => {
  const started = [];

  const runtime = createRNNetworkDebuggerBootstrapRuntime({
    getPlatform: () => 'ios',
    getScriptURL: () =>
      'http://192.168.0.50:8081/index.bundle?platform=ios&dev=true',
    getGlobalObject: () => ({}),
    startCapture: (options) => {
      started.push(options);
      return {stop() {}};
    },
  });

  runtime.bootRNNetworkDebugger({
    VIEWER_PORT: 49001,
    CAPTURE_CONSOLE: true,
  });

  assert.deepEqual(started, [
    {
      viewerURL: `ws://192.168.0.50:49001${DEFAULT_VIEWER_PATH}`,
      maxBodyCaptureCharacters: DEFAULT_MAX_BODY_CAPTURE_CHARACTERS,
      maxBodyPreviewCharacters: 2048,
      maskHeaders: DEFAULT_MASK_HEADERS,
      viewerToken: '',
      captureBodies: true,
      redactSensitiveData: true,
      limitCapture: true,
      redactKeys: [],
      captureConsole: true,
    },
  ]);
});

test('bootstrap fails closed when __DEV__ is false or absent', () => {
  let starts = 0;
  const runtime = createRNNetworkDebuggerBootstrapRuntime({
    startCapture: () => {
      starts++;
    },
  });
  for (const value of [false, undefined]) {
    global.__DEV__ = value;
    assert.equal(runtime.bootRNNetworkDebugger(), null);
  }
  global.__DEV__ = true;
  assert.equal(starts, 0);
});

test('capture preferences default on and preserve explicit false for both naming styles', () => {
  const {normalizeRNNetworkDebuggerConfig} = require('./bootstrapRuntime');
  assert.equal(normalizeRNNetworkDebuggerConfig({}).redactSensitiveData, true);
  assert.equal(normalizeRNNetworkDebuggerConfig({}).limitCapture, true);
  for (const config of [
    {REDACT_SENSITIVE_DATA: false, LIMIT_CAPTURE: false},
    {redactSensitiveData: false, limitCapture: false},
  ]) {
    const started = [];
    const runtime = createRNNetworkDebuggerBootstrapRuntime({
      startCapture: (options) => {
        started.push(options);
        return {stop() {}};
      },
    });
    runtime.bootRNNetworkDebugger(config);
    assert.equal(started[0].redactSensitiveData, false);
    assert.equal(started[0].limitCapture, false);
  }
});
