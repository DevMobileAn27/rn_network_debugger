const DEFAULT_VIEWER_PORT = 38940;
const DEFAULT_VIEWER_PATH = '/rnv/network';
const DEFAULT_MAX_BODY_PREVIEW_CHARACTERS = 2048;
const DEFAULT_MASK_HEADERS = Object.freeze([
  'authorization',
  'cookie',
  'set-cookie',
  'x-access-token',
]);
const GLOBAL_CONTROLLER_KEY = '__RNV_NETWORK_CAPTURE_CONTROLLER__';

function defineRNNetworkDebuggerConfig(config = {}) {
  return config;
}

function createRNNetworkDebuggerBootstrapRuntime(dependencies = {}) {
  const getPlatform =
    typeof dependencies.getPlatform === 'function'
      ? dependencies.getPlatform
      : () => 'ios';
  const getScriptURL =
    typeof dependencies.getScriptURL === 'function'
      ? dependencies.getScriptURL
      : () => null;
  const getGlobalObject =
    typeof dependencies.getGlobalObject === 'function'
      ? dependencies.getGlobalObject
      : () => globalThis;
  const startCapture =
    typeof dependencies.startCapture === 'function'
      ? dependencies.startCapture
      : () => null;

  function resolveViewerHost(input = {}) {
    return resolveRNNetworkDebuggerViewerHost({
      platform: input.platform ?? getPlatform(),
      scriptURL: input.scriptURL ?? getScriptURL(),
      config: input.config,
    });
  }

  function resolveViewerURL(input = {}) {
    return resolveRNNetworkDebuggerViewerURL({
      platform: input.platform ?? getPlatform(),
      scriptURL: input.scriptURL ?? getScriptURL(),
      config: input.config,
    });
  }

  function stopRNNetworkDebuggerBootstrap() {
    const globalObject = safeGlobalObject(getGlobalObject);
    const currentController = globalObject[GLOBAL_CONTROLLER_KEY];
    currentController?.stop?.();
    globalObject[GLOBAL_CONTROLLER_KEY] = undefined;
  }

  function bootRNNetworkDebugger(config = {}) {
    if (!isDevRuntime()) {
      return null;
    }

    stopRNNetworkDebuggerBootstrap();

    const normalizedConfig = normalizeRNNetworkDebuggerConfig(config);
    const controller = startCapture(createStartOptions({
      config: normalizedConfig,
      viewerURL: resolveViewerURL({config: normalizedConfig}),
    }));

    safeGlobalObject(getGlobalObject)[GLOBAL_CONTROLLER_KEY] = controller;
    return controller;
  }

  return {
    bootRNNetworkDebugger,
    resolveRNNetworkDebuggerViewerHost: resolveViewerHost,
    resolveRNNetworkDebuggerViewerURL: resolveViewerURL,
    stopRNNetworkDebuggerBootstrap,
  };
}

function resolveRNNetworkDebuggerViewerHost(input = {}) {
  const normalizedConfig = normalizeRNNetworkDebuggerConfig(input.config);
  const configuredViewerHost = normalizeOptionalString(normalizedConfig.viewerHost);
  if (configuredViewerHost) {
    return stripIPv6Brackets(configuredViewerHost);
  }

  const metroHost = extractHostFromScriptURL(input.scriptURL);
  if (metroHost) {
    return metroHost;
  }

  return input.platform === 'android' ? '10.0.2.2' : '127.0.0.1';
}

function resolveRNNetworkDebuggerViewerURL(input = {}) {
  const normalizedConfig = normalizeRNNetworkDebuggerConfig(input.config);
  const explicitViewerURL = normalizeOptionalString(normalizedConfig.viewerURL);
  if (explicitViewerURL) {
    return explicitViewerURL;
  }

  const host = formatViewerHost(resolveRNNetworkDebuggerViewerHost({
    platform: input.platform,
    scriptURL: input.scriptURL,
    config: normalizedConfig,
  }));

  return `ws://${host}:${normalizedConfig.viewerPort}${normalizedConfig.viewerPath}`;
}

function createStartOptions(input = {}) {
  const normalizedConfig = normalizeRNNetworkDebuggerConfig(input.config);
  const startOptions = {
    viewerURL: input.viewerURL,
    maxBodyPreviewCharacters: normalizedConfig.maxBodyPreviewCharacters,
    maskHeaders: normalizedConfig.maskHeaders,
  };

  if (typeof normalizedConfig.captureFetch === 'boolean') {
    startOptions.captureFetch = normalizedConfig.captureFetch;
  }

  if (typeof normalizedConfig.captureXMLHttpRequest === 'boolean') {
    startOptions.captureXMLHttpRequest = normalizedConfig.captureXMLHttpRequest;
  }

  if (typeof normalizedConfig.maxBatchSize === 'number') {
    startOptions.maxBatchSize = normalizedConfig.maxBatchSize;
  }

  if (typeof normalizedConfig.flushIntervalMs === 'number') {
    startOptions.flushIntervalMs = normalizedConfig.flushIntervalMs;
  }

  return startOptions;
}

function normalizeRNNetworkDebuggerConfig(config = {}) {
  const normalizedMaskHeaders = Array.isArray(config.maskHeaders)
    ? config.maskHeaders
    : Array.isArray(config.MASK_HEADERS)
      ? config.MASK_HEADERS
      : DEFAULT_MASK_HEADERS;

  return {
    viewerHost: coalesce(config.viewerHost, config.VIEWER_HOST, null),
    viewerPath: normalizeViewerPath(
      coalesce(config.viewerPath, config.VIEWER_PATH, DEFAULT_VIEWER_PATH),
    ),
    viewerPort: normalizePositiveInteger(
      coalesce(config.viewerPort, config.VIEWER_PORT, DEFAULT_VIEWER_PORT),
      DEFAULT_VIEWER_PORT,
    ),
    viewerURL: coalesce(config.viewerURL, config.VIEWER_URL, null),
    maxBodyPreviewCharacters: normalizePositiveInteger(
      coalesce(
        config.maxBodyPreviewCharacters,
        config.MAX_BODY_PREVIEW_CHARACTERS,
        DEFAULT_MAX_BODY_PREVIEW_CHARACTERS,
      ),
      DEFAULT_MAX_BODY_PREVIEW_CHARACTERS,
    ),
    maskHeaders: normalizedMaskHeaders.map(header => String(header).toLowerCase()),
    captureFetch: normalizeOptionalBoolean(
      coalesce(config.captureFetch, config.CAPTURE_FETCH, undefined),
    ),
    captureXMLHttpRequest: normalizeOptionalBoolean(
      coalesce(
        config.captureXMLHttpRequest,
        config.CAPTURE_XML_HTTP_REQUEST,
        undefined,
      ),
    ),
    maxBatchSize: normalizeOptionalPositiveInteger(
      coalesce(config.maxBatchSize, config.MAX_BATCH_SIZE, undefined),
    ),
    flushIntervalMs: normalizeOptionalPositiveInteger(
      coalesce(config.flushIntervalMs, config.FLUSH_INTERVAL_MS, undefined),
    ),
  };
}

function extractHostFromScriptURL(scriptURL) {
  const value = String(scriptURL ?? '').trim();
  if (value.length === 0) {
    return null;
  }

  const match = /^(?:https?|ws|wss):\/\/(\[[^\]]+\]|[^/:?#]+)(?::\d+)?(?:[/?#]|$)/i.exec(value);
  if (!match?.[1]) {
    return null;
  }

  return stripIPv6Brackets(match[1]);
}

function formatViewerHost(host) {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

function stripIPv6Brackets(host) {
  return String(host || '').replace(/^\[(.*)\]$/, '$1');
}

function normalizeViewerPath(path) {
  const normalizedValue = String(path || '').trim();
  if (normalizedValue.length === 0) {
    return DEFAULT_VIEWER_PATH;
  }

  return normalizedValue.startsWith('/') ? normalizedValue : `/${normalizedValue}`;
}

function normalizePositiveInteger(value, fallbackValue) {
  const parsedValue = Number.parseInt(String(value), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function normalizeOptionalPositiveInteger(value) {
  if (value == null) {
    return undefined;
  }

  const parsedValue = Number.parseInt(String(value), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
}

function normalizeOptionalBoolean(value) {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeOptionalString(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function coalesce(...values) {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function safeGlobalObject(factory) {
  const globalObject = factory?.();
  if (globalObject && typeof globalObject === 'object') {
    return globalObject;
  }

  return {};
}

function isDevRuntime() {
  return typeof __DEV__ === 'undefined' ? true : Boolean(__DEV__);
}

module.exports = {
  DEFAULT_MASK_HEADERS,
  DEFAULT_MAX_BODY_PREVIEW_CHARACTERS,
  DEFAULT_VIEWER_PATH,
  DEFAULT_VIEWER_PORT,
  GLOBAL_CONTROLLER_KEY,
  createRNNetworkDebuggerBootstrapRuntime,
  defineRNNetworkDebuggerConfig,
  resolveRNNetworkDebuggerViewerHost,
  resolveRNNetworkDebuggerViewerURL,
  normalizeRNNetworkDebuggerConfig,
};
