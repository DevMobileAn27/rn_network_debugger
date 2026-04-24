import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

const {createConsoleCaptureRuntime} = require('../../consoleCaptureRuntime');

const MODULE_NAME = 'RNVNetworkDevModule';
const STATUS_EVENT_NAME = 'RNVNetworkDevStatus';
const SCHEMA_VERSION = 1;
const VIEWER_INGEST_PORT = 38940;

const NativeModule = NativeModules[MODULE_NAME];
const nativeEventEmitter = NativeModule ? new NativeEventEmitter(NativeModule) : null;

const DEFAULT_OPTIONS = Object.freeze({
  enabled: true,
  viewerURL: 'ws://127.0.0.1:38940/rnv/network',
  captureFetch: true,
  captureXMLHttpRequest: true,
  captureConsole: true,
  maxBodyPreviewCharacters: 2048,
  maxBodyCaptureCharacters: null,
  maxBatchSize: 20,
  flushIntervalMs: 150,
  maskHeaders: ['authorization', 'cookie', 'set-cookie', 'x-access-token'],
});

const state = {
  isPatched: false,
  isStarted: false,
  options: {...DEFAULT_OPTIONS},
  originalFetch: null,
  originalXMLHttpRequestOpen: null,
  originalXMLHttpRequestSend: null,
  originalXMLHttpRequestSetRequestHeader: null,
  originalXMLHttpRequestAbort: null,
  nextRequestSequence: 1,
  pendingEvents: [],
  flushTimer: null,
};
const consoleCaptureRuntime = createConsoleCaptureRuntime({
  getConsole: () => globalThis.console,
  emitEvent: event => {
    enqueueEvent(event);
  },
});

export function startRNVNetworkCapture(options = {}) {
  if (!shouldEnableSDK()) {
    return createNoopController('SDK is available only on iOS dev builds.');
  }

  if (!NativeModule) {
    return createNoopController('Native module RNVNetworkDevModule is unavailable.');
  }

  state.options = normalizeOptions(options);
  const viewerURLValidation = validateViewerURL(state.options.viewerURL);
  if (!viewerURLValidation.isValid) {
    state.isStarted = false;
    NativeModule?.setEnabled?.(false);
    console.warn(`[RNVNetworkSDK] ${viewerURLValidation.reason}`);
    return createNoopController(viewerURLValidation.reason);
  }

  state.isStarted = true;

  NativeModule.configure({
    enabled: true,
    viewerURL: state.options.viewerURL,
    maxQueueSize: state.options.maxBatchSize * 10,
    connectionHeaders: {
      'x-rnv-sdk-platform': 'ios',
      'x-rnv-sdk-schema-version': String(SCHEMA_VERSION),
    },
  });

  installPatches();

  return createController();
}

export function stopRNVNetworkCapture() {
  state.isStarted = false;
  clearFlushTimer();
  state.pendingEvents = [];
  state.options = {...DEFAULT_OPTIONS};
  state.nextRequestSequence = 1;
  consoleCaptureRuntime.stop();

  NativeModule?.setEnabled?.(false);

  if (state.originalFetch) {
    global.fetch = state.originalFetch;
  }

  if (state.originalXMLHttpRequestOpen) {
    XMLHttpRequest.prototype.open = state.originalXMLHttpRequestOpen;
  }

  if (state.originalXMLHttpRequestSend) {
    XMLHttpRequest.prototype.send = state.originalXMLHttpRequestSend;
  }

  if (state.originalXMLHttpRequestSetRequestHeader) {
    XMLHttpRequest.prototype.setRequestHeader = state.originalXMLHttpRequestSetRequestHeader;
  }

  if (state.originalXMLHttpRequestAbort) {
    XMLHttpRequest.prototype.abort = state.originalXMLHttpRequestAbort;
  }

  state.originalFetch = null;
  state.originalXMLHttpRequestOpen = null;
  state.originalXMLHttpRequestSend = null;
  state.originalXMLHttpRequestSetRequestHeader = null;
  state.originalXMLHttpRequestAbort = null;
  state.isPatched = false;
}

export function addRNVNetworkListener(listener) {
  if (!nativeEventEmitter) {
    return {remove() {}};
  }

  return nativeEventEmitter.addListener(STATUS_EVENT_NAME, listener);
}

export function createRNVNetworkCaptureController(options = {}) {
  return startRNVNetworkCapture(options);
}

function createController() {
  return {
    stop: stopRNVNetworkCapture,
    reconfigure(nextOptions = {}) {
      const previousCaptureConsole = state.options.captureConsole;
      state.options = normalizeOptions({...state.options, ...nextOptions});
      const viewerURLValidation = validateViewerURL(state.options.viewerURL);
      if (!viewerURLValidation.isValid) {
        NativeModule?.setEnabled?.(false);
        console.warn(`[RNVNetworkSDK] ${viewerURLValidation.reason}`);
        return;
      }

      if (state.options.captureConsole && !previousCaptureConsole) {
        consoleCaptureRuntime.start();
      }

      if (!state.options.captureConsole && previousCaptureConsole) {
        consoleCaptureRuntime.stop();
      }

      NativeModule?.configure?.({
        enabled: true,
        viewerURL: state.options.viewerURL,
        maxQueueSize: state.options.maxBatchSize * 10,
        connectionHeaders: {
          'x-rnv-sdk-platform': 'ios',
          'x-rnv-sdk-schema-version': String(SCHEMA_VERSION),
        },
      });
    },
  };
}

function createNoopController(reason) {
  return {
    reason,
    stop() {},
    reconfigure() {},
  };
}

function shouldEnableSDK() {
  return Platform.OS === 'ios' && typeof __DEV__ !== 'undefined' && __DEV__;
}

function normalizeOptions(options) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    captureConsole:
      typeof options.captureConsole === 'boolean'
        ? options.captureConsole
        : DEFAULT_OPTIONS.captureConsole,
    maxBodyPreviewCharacters: normalizePositiveInteger(
      options.maxBodyPreviewCharacters,
      DEFAULT_OPTIONS.maxBodyPreviewCharacters,
    ),
    maxBodyCaptureCharacters: normalizeCaptureCharacterLimit(
      options.maxBodyCaptureCharacters,
      DEFAULT_OPTIONS.maxBodyCaptureCharacters,
    ),
    maskHeaders: Array.isArray(options.maskHeaders) ? options.maskHeaders.map(header => String(header).toLowerCase()) : DEFAULT_OPTIONS.maskHeaders,
  };
}

function validateViewerURL(viewerURL) {
  const normalizedValue = String(viewerURL || '').trim();
  if (normalizedValue.length === 0) {
    return {
      isValid: false,
      reason: 'viewerURL is missing. Expected React Native Viewer ingest endpoint, for example ws://<mac-ip>:38940/rnv/network.',
    };
  }

  const parsedURL = parseWebSocketURL(normalizedValue);
  if (!parsedURL) {
    return {
      isValid: false,
      reason: 'viewerURL is invalid. Expected websocket endpoint like ws://<mac-ip>:38940/rnv/network.',
    };
  }

  if (!['ws', 'wss'].includes(parsedURL.scheme)) {
    return {
      isValid: false,
      reason: 'viewerURL must use ws:// or wss://.',
    };
  }

  if (parsedURL.port !== VIEWER_INGEST_PORT) {
    return {
      isValid: false,
      reason: `viewerURL must use the React Native Viewer ingest port ${VIEWER_INGEST_PORT}, not a React Native/Metro dev server port like 8081.`,
    };
  }

  const normalizedPath = parsedURL.path.replace(/\/+$/, '');
  if (isLikelyInspectorURL(parsedURL)) {
    return {
      isValid: false,
      reason: 'viewerURL looks like a React Native inspector/devtools endpoint. Use the React Native Viewer ingest endpoint instead: ws://<mac-ip>:38940/rnv/network.',
    };
  }

  if (normalizedPath !== '/rnv/network') {
    return {
      isValid: false,
      reason: 'viewerURL must point to the React Native Viewer ingest path /rnv/network.',
    };
  }

  return {isValid: true};
}

function isLikelyInspectorURL(parsedURL) {
  const normalizedPath = parsedURL.path.replace(/\/+$/, '');
  return (
    normalizedPath.includes('/inspector') ||
    normalizedPath.includes('/json/list') ||
    normalizedPath.includes('/json') ||
    normalizedPath.includes('/devtools')
  );
}

function parseWebSocketURL(value) {
  const match = /^(ws|wss):\/\/([^/?#]+)(\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/i.exec(value);
  if (!match) {
    return null;
  }

  return {
    scheme: String(match[1] || '').toLowerCase(),
    host: stripPort(match[2] || ''),
    port: parsePort(match[2] || ''),
    path: normalizeURLPath(match[3] || '/'),
  };
}

function parsePort(authority) {
  const normalizedAuthority = String(authority || '');
  if (normalizedAuthority.startsWith('[')) {
    const closingBracketIndex = normalizedAuthority.indexOf(']');
    if (closingBracketIndex === -1) {
      return null;
    }

    const remainder = normalizedAuthority.slice(closingBracketIndex + 1);
    if (!remainder.startsWith(':')) {
      return null;
    }

    const port = Number.parseInt(remainder.slice(1), 10);
    return Number.isFinite(port) ? port : null;
  }

  const separatorIndex = normalizedAuthority.lastIndexOf(':');
  if (separatorIndex === -1) {
    return null;
  }

  const port = Number.parseInt(normalizedAuthority.slice(separatorIndex + 1), 10);
  return Number.isFinite(port) ? port : null;
}

function stripPort(authority) {
  const normalizedAuthority = String(authority || '');
  if (normalizedAuthority.startsWith('[')) {
    const closingBracketIndex = normalizedAuthority.indexOf(']');
    return closingBracketIndex === -1 ? normalizedAuthority : normalizedAuthority.slice(0, closingBracketIndex + 1);
  }

  const separatorIndex = normalizedAuthority.lastIndexOf(':');
  if (separatorIndex === -1) {
    return normalizedAuthority;
  }

  return normalizedAuthority.slice(0, separatorIndex);
}

function normalizeURLPath(path) {
  const normalizedValue = String(path || '/');
  if (normalizedValue === '/') {
    return '/';
  }

  return normalizedValue.replace(/\/+$/, '') || '/';
}

function installPatches() {
  if (state.isPatched) {
    return;
  }

  if (state.options.captureFetch && typeof global.fetch === 'function') {
    state.originalFetch = global.fetch.bind(global);
    global.fetch = createFetchWrapper(state.originalFetch);
  }

  if (state.options.captureXMLHttpRequest && typeof XMLHttpRequest !== 'undefined') {
    const prototype = XMLHttpRequest.prototype;
    state.originalXMLHttpRequestOpen = prototype.open;
    state.originalXMLHttpRequestSend = prototype.send;
    state.originalXMLHttpRequestSetRequestHeader = prototype.setRequestHeader;
    state.originalXMLHttpRequestAbort = prototype.abort;

    prototype.open = createXHROpenWrapper(state.originalXMLHttpRequestOpen);
    prototype.setRequestHeader = createXHRSetRequestHeaderWrapper(state.originalXMLHttpRequestSetRequestHeader);
    prototype.send = createXHRSendWrapper(state.originalXMLHttpRequestSend);
    prototype.abort = createXHRAbortWrapper(state.originalXMLHttpRequestAbort);
  }

  if (state.options.captureConsole) {
    consoleCaptureRuntime.start();
  }

  state.isPatched = true;
}

function createFetchWrapper(originalFetch) {
  return async function rnvInstrumentedFetch(input, init) {
    const requestId = nextRequestId('fetch');
    const startedAt = Date.now();
    const requestDescriptor = describeFetchRequest(
      input,
      init,
      state.options.maskHeaders,
      state.options.maxBodyPreviewCharacters,
      state.options.maxBodyCaptureCharacters,
    );

    enqueueEvent({
      requestId,
      phase: 'request',
      source: 'js.fetch',
      request: requestDescriptor,
      startedAt,
    });

    try {
      const response = await originalFetch(input, init);
      const responseBody = await extractFetchResponseBody(
        response,
        state.options.maxBodyCaptureCharacters,
      );

      enqueueEvent({
        requestId,
        phase: 'response',
        source: 'js.fetch',
        durationMs: Date.now() - startedAt,
        response: {
          statusCode: response.status,
          statusText: response.statusText,
          headers: sanitizeHeaders(headersToObject(response.headers), state.options.maskHeaders),
          body: responseBody,
          bodyPreview: previewCapturedBody(
            responseBody,
            state.options.maxBodyPreviewCharacters,
          ),
        },
      });

      return response;
    } catch (error) {
      enqueueEvent({
        requestId,
        phase: 'error',
        source: 'js.fetch',
        durationMs: Date.now() - startedAt,
        error: {
          message: extractErrorMessage(error),
        },
      });
      throw error;
    }
  };
}

function createXHROpenWrapper(originalOpen) {
  return function rnvInstrumentedOpen(method, url, async, user, password) {
    const metadata = ensureXHRMetadata(this);
    metadata.method = typeof method === 'string' ? method : 'GET';
    metadata.url = String(url);
    metadata.async = async;
    return originalOpen.call(this, method, url, async, user, password);
  };
}

function createXHRSetRequestHeaderWrapper(originalSetRequestHeader) {
  return function rnvInstrumentedSetRequestHeader(name, value) {
    const metadata = ensureXHRMetadata(this);
    metadata.requestHeaders[String(name)] = String(value);
    return originalSetRequestHeader.call(this, name, value);
  };
}

function createXHRSendWrapper(originalSend) {
  return function rnvInstrumentedSend(body) {
    const metadata = ensureXHRMetadata(this);
    metadata.requestId = nextRequestId('xhr');
    metadata.startedAt = Date.now();
    metadata.requestBody = captureBody(
      body,
      state.options.maxBodyCaptureCharacters,
    );
    metadata.requestBodyPreview = previewCapturedBody(
      metadata.requestBody,
      state.options.maxBodyPreviewCharacters,
    );

    enqueueEvent({
      requestId: metadata.requestId,
      phase: 'request',
      source: 'js.xhr',
      request: {
        method: metadata.method || 'GET',
        url: metadata.url || '',
        headers: sanitizeHeaders(metadata.requestHeaders, state.options.maskHeaders),
        body: metadata.requestBody,
        bodyPreview: metadata.requestBodyPreview,
        requestKind: 'xhr',
      },
      startedAt: metadata.startedAt,
    });

    const handleReadyStateChange = () => {
      if (this.readyState !== 4 || metadata.didFinish) {
        return;
      }

      metadata.didFinish = true;
      teardownXHRListeners(this, metadata);
      const responseBody = extractXHRResponseBody(
        this,
        state.options.maxBodyCaptureCharacters,
      );

      enqueueEvent({
        requestId: metadata.requestId,
        phase: 'response',
        source: 'js.xhr',
        durationMs: Date.now() - metadata.startedAt,
        response: {
          statusCode: this.status,
          statusText: this.statusText,
          headers: sanitizeHeaders(parseRawXHRHeaders(this.getAllResponseHeaders()), state.options.maskHeaders),
          body: responseBody,
          bodyPreview: previewCapturedBody(
            responseBody,
            state.options.maxBodyPreviewCharacters,
          ),
        },
      });
    };

    const handleFailure = eventType => () => {
      if (metadata.didFinish) {
        return;
      }

      metadata.didFinish = true;
      teardownXHRListeners(this, metadata);

      enqueueEvent({
        requestId: metadata.requestId,
        phase: 'error',
        source: 'js.xhr',
        durationMs: Date.now() - metadata.startedAt,
        error: {
          message: `XMLHttpRequest ${eventType}`,
        },
      });
    };

    metadata.readyStateHandler = handleReadyStateChange;
    metadata.abortHandler = handleFailure('abort');
    metadata.errorHandler = handleFailure('error');
    metadata.timeoutHandler = handleFailure('timeout');

    this.addEventListener('readystatechange', metadata.readyStateHandler);
    this.addEventListener('abort', metadata.abortHandler);
    this.addEventListener('error', metadata.errorHandler);
    this.addEventListener('timeout', metadata.timeoutHandler);

    return originalSend.call(this, body);
  };
}

function createXHRAbortWrapper(originalAbort) {
  return function rnvInstrumentedAbort() {
    const metadata = ensureXHRMetadata(this);
    metadata.didAbort = true;
    return originalAbort.call(this);
  };
}

function enqueueEvent(event) {
  if (!state.isStarted || !NativeModule?.captureEvents) {
    return;
  }

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    platform: 'ios',
    timestamp: new Date().toISOString(),
    ...event,
  };

  state.pendingEvents.push(payload);

  if (state.pendingEvents.length >= state.options.maxBatchSize) {
    flushPendingEvents();
    return;
  }

  scheduleFlush();
}

function scheduleFlush() {
  if (state.flushTimer) {
    return;
  }

  state.flushTimer = setTimeout(() => {
    flushPendingEvents();
  }, state.options.flushIntervalMs);
}

function flushPendingEvents() {
  clearFlushTimer();

  if (!state.pendingEvents.length || !NativeModule?.captureEvents) {
    return;
  }

  const batch = state.pendingEvents.splice(0, state.pendingEvents.length);
  NativeModule.captureEvents(batch);
}

function clearFlushTimer() {
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    state.flushTimer = null;
  }
}

function nextRequestId(prefix) {
  const sequence = state.nextRequestSequence++;
  return `${prefix}-${Date.now()}-${sequence}`;
}

function describeFetchRequest(input, init, maskedHeaders, maxPreviewSize, maxCaptureSize) {
  const requestLike = input && typeof input === 'object' ? input : null;
  const method = String(init?.method || requestLike?.method || 'GET').toUpperCase();
  const url = extractFetchURL(input);

  const requestHeaders = sanitizeHeaders(
    mergeHeaderMaps(
      headersToObject(requestLike?.headers),
      headersToObject(init?.headers),
    ),
    maskedHeaders,
  );

  const requestBody = captureBody(
    init?.body ?? requestLike?._bodyInit ?? requestLike?.body,
    maxCaptureSize,
  );
  const requestBodyPreview = previewCapturedBody(requestBody, maxPreviewSize);

  return {
    method,
    url,
    headers: requestHeaders,
    body: requestBody,
    bodyPreview: requestBodyPreview,
    requestKind: 'fetch',
  };
}

function extractFetchURL(input) {
  if (typeof input === 'string') {
    return input;
  }

  if (input && typeof input.url === 'string') {
    return input.url;
  }

  return '';
}

async function extractFetchResponseBody(response, maxCaptureSize) {
  if (!response || typeof response.clone !== 'function') {
    return null;
  }

  const contentType = response.headers?.get?.('content-type') || '';
  if (!isTextLikeContentType(contentType)) {
    return null;
  }

  try {
    const clone = response.clone();
    const text = await clone.text();
    return limitText(text, maxCaptureSize);
  } catch (error) {
    return null;
  }
}

function extractXHRResponseBody(xhr, maxCaptureSize) {
  try {
    if (xhr.responseType && xhr.responseType !== '' && xhr.responseType !== 'text') {
      return null;
    }

    if (typeof xhr.responseText === 'string') {
      return limitText(xhr.responseText, maxCaptureSize);
    }
  } catch (error) {
    return null;
  }

  return null;
}

function ensureXHRMetadata(xhr) {
  if (!xhr.__rnvNetworkMetadata) {
    Object.defineProperty(xhr, '__rnvNetworkMetadata', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: {
        method: 'GET',
        url: '',
        requestHeaders: {},
        didFinish: false,
      },
    });
  }

  return xhr.__rnvNetworkMetadata;
}

function teardownXHRListeners(xhr, metadata) {
  if (metadata.readyStateHandler) {
    xhr.removeEventListener('readystatechange', metadata.readyStateHandler);
  }

  if (metadata.abortHandler) {
    xhr.removeEventListener('abort', metadata.abortHandler);
  }

  if (metadata.errorHandler) {
    xhr.removeEventListener('error', metadata.errorHandler);
  }

  if (metadata.timeoutHandler) {
    xhr.removeEventListener('timeout', metadata.timeoutHandler);
  }
}

function captureBody(value, maxCaptureSize) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return limitText(value, maxCaptureSize);
  }

  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    return '[FormData]';
  }

  if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) {
    return limitText(value.toString(), maxCaptureSize);
  }

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return `[Blob size=${value.size}]`;
  }

  if (ArrayBuffer.isView(value)) {
    return `[TypedArray length=${value.byteLength}]`;
  }

  if (value instanceof ArrayBuffer) {
    return `[ArrayBuffer byteLength=${value.byteLength}]`;
  }

  if (typeof value === 'object') {
    try {
      return limitText(JSON.stringify(value), maxCaptureSize);
    } catch (error) {
      return '[Unserializable Object]';
    }
  }

  return limitText(String(value), maxCaptureSize);
}

function previewCapturedBody(value, maxPreviewSize) {
  if (typeof value !== 'string') {
    return null;
  }

  return truncateText(value, maxPreviewSize);
}

function limitText(text, maxSize) {
  if (typeof text !== 'string') {
    return null;
  }

  if (maxSize == null) {
    return text;
  }

  if (text.length <= maxSize) {
    return text;
  }

  return `${text.slice(0, maxSize)}…`;
}

function truncateText(text, maxPreviewSize) {
  if (typeof text !== 'string') {
    return null;
  }

  if (text.length <= maxPreviewSize) {
    return text;
  }

  return `${text.slice(0, maxPreviewSize)}…`;
}

function normalizePositiveInteger(value, fallbackValue) {
  const parsedValue = Number.parseInt(String(value), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function normalizeCaptureCharacterLimit(value, fallbackValue) {
  if (value == null) {
    return fallbackValue;
  }

  if (value === 0 || value === '0') {
    return null;
  }

  const parsedValue = Number.parseInt(String(value), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function mergeHeaderMaps(...maps) {
  return maps.reduce((accumulator, currentMap) => {
    Object.entries(currentMap || {}).forEach(([key, value]) => {
      accumulator[key] = value;
    });
    return accumulator;
  }, {});
}

function headersToObject(headers) {
  if (!headers) {
    return {};
  }

  if (typeof headers.forEach === 'function') {
    const object = {};
    headers.forEach((value, key) => {
      object[key] = value;
    });
    return object;
  }

  if (Array.isArray(headers)) {
    return headers.reduce((accumulator, pair) => {
      if (Array.isArray(pair) && pair.length >= 2) {
        accumulator[String(pair[0])] = String(pair[1]);
      }
      return accumulator;
    }, {});
  }

  if (typeof headers === 'object') {
    return Object.keys(headers).reduce((accumulator, key) => {
      accumulator[key] = String(headers[key]);
      return accumulator;
    }, {});
  }

  return {};
}

function sanitizeHeaders(headers, maskedHeaders) {
  return Object.entries(headers || {}).reduce((accumulator, [key, value]) => {
    const normalizedKey = String(key);
    if (maskedHeaders.includes(normalizedKey.toLowerCase())) {
      accumulator[normalizedKey] = '[Masked]';
    } else {
      accumulator[normalizedKey] = value;
    }
    return accumulator;
  }, {});
}

function parseRawXHRHeaders(rawHeaders) {
  if (!rawHeaders) {
    return {};
  }

  return rawHeaders
    .trim()
    .split(/[\r\n]+/)
    .reduce((accumulator, line) => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function isTextLikeContentType(contentType) {
  const value = String(contentType || '').toLowerCase();
  return (
    value.includes('application/json') ||
    value.includes('application/xml') ||
    value.includes('application/x-www-form-urlencoded') ||
    value.includes('text/') ||
    value.includes('+json') ||
    value.includes('+xml')
  );
}

function extractErrorMessage(error) {
  if (!error) {
    return 'Unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }

  return String(error);
}
