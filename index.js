import {NativeModules, Platform} from 'react-native';

const {
  DEFAULT_MAX_BODY_CAPTURE_CHARACTERS,
  DEFAULT_MASK_HEADERS,
  DEFAULT_MAX_BODY_PREVIEW_CHARACTERS,
  DEFAULT_VIEWER_PATH,
  DEFAULT_VIEWER_PORT,
  createRNNetworkDebuggerBootstrapRuntime,
  defineRNNetworkDebuggerConfig,
  normalizeRNNetworkDebuggerConfig,
} = require('./bootstrapRuntime');

const implementation = Platform.OS === 'ios' ? require('./ios/js/index.js') : require('./android/js/index.js');

const {
  addRNVNetworkListener,
  createRNVNetworkCaptureController,
  startRNVNetworkCapture,
  stopRNVNetworkCapture,
} = implementation;

const bootstrapRuntime = createRNNetworkDebuggerBootstrapRuntime({
  getPlatform: () => Platform.OS,
  getScriptURL: () => NativeModules?.SourceCode?.scriptURL ?? null,
  getGlobalObject: () => globalThis,
  startCapture: startRNVNetworkCapture,
});

const {
  bootRNNetworkDebugger,
  bootRNNetworkDebuggerWithPort,
  resolveRNNetworkDebuggerViewerHost,
  resolveRNNetworkDebuggerViewerURL,
  stopRNNetworkDebuggerBootstrap,
} = bootstrapRuntime;

const addRNNetworkDebuggerListener = addRNVNetworkListener;
const createRNNetworkDebuggerController = createRNVNetworkCaptureController;
const startRNNetworkDebugger = startRNVNetworkCapture;
const stopRNNetworkDebugger = stopRNVNetworkCapture;
const bootRNVNetworkCapture = bootRNNetworkDebugger;
const bootRNVNetworkCaptureWithPort = bootRNNetworkDebuggerWithPort;
const resolveRNVViewerHost = resolveRNNetworkDebuggerViewerHost;
const resolveRNVViewerURL = resolveRNNetworkDebuggerViewerURL;
const stopRNVNetworkCaptureBootstrap = stopRNNetworkDebuggerBootstrap;

export {
  addRNNetworkDebuggerListener,
  createRNNetworkDebuggerController,
  bootRNNetworkDebugger,
  bootRNNetworkDebuggerWithPort,
  DEFAULT_MAX_BODY_CAPTURE_CHARACTERS,
  DEFAULT_MASK_HEADERS,
  DEFAULT_MAX_BODY_PREVIEW_CHARACTERS,
  DEFAULT_VIEWER_PATH,
  DEFAULT_VIEWER_PORT,
  defineRNNetworkDebuggerConfig,
  normalizeRNNetworkDebuggerConfig,
  resolveRNNetworkDebuggerViewerHost,
  resolveRNNetworkDebuggerViewerURL,
  startRNNetworkDebugger,
  stopRNNetworkDebugger,
  stopRNNetworkDebuggerBootstrap,
  addRNVNetworkListener,
  bootRNVNetworkCapture,
  bootRNVNetworkCaptureWithPort,
  createRNVNetworkCaptureController,
  resolveRNVViewerHost,
  resolveRNVViewerURL,
  startRNVNetworkCapture,
  stopRNVNetworkCapture,
  stopRNVNetworkCaptureBootstrap,
};

export default {
  addRNNetworkDebuggerListener,
  createRNNetworkDebuggerController,
  bootRNNetworkDebugger,
  bootRNNetworkDebuggerWithPort,
  DEFAULT_MAX_BODY_CAPTURE_CHARACTERS,
  DEFAULT_MASK_HEADERS,
  DEFAULT_MAX_BODY_PREVIEW_CHARACTERS,
  DEFAULT_VIEWER_PATH,
  DEFAULT_VIEWER_PORT,
  defineRNNetworkDebuggerConfig,
  normalizeRNNetworkDebuggerConfig,
  resolveRNNetworkDebuggerViewerHost,
  resolveRNNetworkDebuggerViewerURL,
  startRNNetworkDebugger,
  stopRNNetworkDebugger,
  stopRNNetworkDebuggerBootstrap,
  addRNVNetworkListener,
  bootRNVNetworkCapture,
  bootRNVNetworkCaptureWithPort,
  createRNVNetworkCaptureController,
  resolveRNVViewerHost,
  resolveRNVViewerURL,
  startRNVNetworkCapture,
  stopRNVNetworkCapture,
  stopRNVNetworkCaptureBootstrap,
};
