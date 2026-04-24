const DEFAULT_CAPTURED_LEVELS = Object.freeze([
  'log',
  'info',
  'warn',
  'error',
  'debug',
]);
const DEFAULT_MAX_SERIALIZATION_DEPTH = 8;
const DEFAULT_MAX_COLLECTION_SIZE = 100;

function createConsoleCaptureRuntime(dependencies = {}) {
  const getConsole =
    typeof dependencies.getConsole === 'function'
      ? dependencies.getConsole
      : () => globalThis.console;
  const emitEvent =
    typeof dependencies.emitEvent === 'function'
      ? dependencies.emitEvent
      : () => {};
  const createTimestamp =
    typeof dependencies.createTimestamp === 'function'
      ? dependencies.createTimestamp
      : () => new Date().toISOString();

  let installedConsole = null;
  let isInstalled = false;
  let isEmitting = false;
  let originalMethods = {};

  function start(options = {}) {
    stop();

    const consoleObject = getConsole?.();
    if (!consoleObject || typeof consoleObject !== 'object') {
      return;
    }

    const levels = normalizeConsoleLevels(options.levels);
    installedConsole = consoleObject;

    levels.forEach(level => {
      if (typeof consoleObject[level] !== 'function') {
        return;
      }

      const originalMethod = consoleObject[level];
      originalMethods[level] = originalMethod;

      consoleObject[level] = function rnvInstrumentedConsole(...args) {
        originalMethod.apply(consoleObject, args);

        if (isEmitting) {
          return;
        }

        isEmitting = true;
        try {
          emitEvent({
            source: 'js.console',
            level,
            timestamp: createTimestamp(),
            message: formatConsoleMessage(args, options),
            args: serializeConsoleArguments(args, options),
          });
        } finally {
          isEmitting = false;
        }
      };
    });

    isInstalled = Object.keys(originalMethods).length > 0;
  }

  function stop() {
    if (!isInstalled || !installedConsole) {
      originalMethods = {};
      installedConsole = null;
      return;
    }

    Object.entries(originalMethods).forEach(([level, originalMethod]) => {
      installedConsole[level] = originalMethod;
    });

    originalMethods = {};
    installedConsole = null;
    isInstalled = false;
  }

  return {
    start,
    stop,
  };
}

function serializeConsoleArguments(args, options = {}) {
  return args.map(value => ({
    type: detectConsoleValueType(value),
    value: serializeConsoleValue(value, createSerializationOptions(options)),
  }));
}

function formatConsoleMessage(args, options = {}) {
  return args
    .map(value => formatConsoleValue(value, createSerializationOptions(options)))
    .join(' ');
}

function formatConsoleValue(value, options) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return String(value);
  }

  const serializedValue = serializeConsoleValue(value, options);
  if (typeof serializedValue === 'string') {
    return serializedValue;
  }

  return safeJSONStringify(serializedValue);
}

function serializeConsoleValue(value, options, depth = 0, seen = new WeakSet()) {
  if (value == null) {
    return value;
  }

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return value;
  }

  if (valueType === 'undefined') {
    return '[Undefined]';
  }

  if (valueType === 'bigint') {
    return value.toString();
  }

  if (valueType === 'symbol') {
    return value.toString();
  }

  if (valueType === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack || null,
    };
  }

  if (value instanceof RegExp) {
    return value.toString();
  }

  if (typeof URL !== 'undefined' && value instanceof URL) {
    return value.toString();
  }

  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    return '[FormData]';
  }

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return `[Blob size=${value.size}]`;
  }

  if (ArrayBuffer.isView(value)) {
    return `[${value.constructor?.name || 'TypedArray'} length=${value.byteLength}]`;
  }

  if (value instanceof ArrayBuffer) {
    return `[ArrayBuffer byteLength=${value.byteLength}]`;
  }

  if (depth >= options.maxDepth) {
    return Array.isArray(value) ? '[Array]' : '[Object]';
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return value
        .slice(0, options.maxEntries)
        .map(item => serializeConsoleValue(item, options, depth + 1, seen));
    }

    if (value instanceof Map) {
      return {
        entries: Array.from(value.entries())
          .slice(0, options.maxEntries)
          .map(([key, mapValue]) => ({
            key: serializeConsoleValue(key, options, depth + 1, seen),
            value: serializeConsoleValue(mapValue, options, depth + 1, seen),
          })),
      };
    }

    if (value instanceof Set) {
      return {
        values: Array.from(value.values())
          .slice(0, options.maxEntries)
          .map(item => serializeConsoleValue(item, options, depth + 1, seen)),
      };
    }

    return Object.keys(value)
      .slice(0, options.maxEntries)
      .reduce((accumulator, key) => {
        accumulator[key] = serializeConsoleValue(value[key], options, depth + 1, seen);
        return accumulator;
      }, {});
  } finally {
    seen.delete(value);
  }
}

function detectConsoleValueType(value) {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  if (value instanceof Error) {
    return 'error';
  }

  if (value instanceof Date) {
    return 'date';
  }

  if (value instanceof RegExp) {
    return 'regexp';
  }

  return typeof value;
}

function normalizeConsoleLevels(levels) {
  if (!Array.isArray(levels) || levels.length === 0) {
    return DEFAULT_CAPTURED_LEVELS;
  }

  return Array.from(
    new Set(
      levels.filter(level => typeof level === 'string' && level.length > 0),
    ),
  );
}

function createSerializationOptions(options = {}) {
  return {
    maxDepth: normalizePositiveInteger(
      options.maxDepth,
      DEFAULT_MAX_SERIALIZATION_DEPTH,
    ),
    maxEntries: normalizePositiveInteger(
      options.maxEntries,
      DEFAULT_MAX_COLLECTION_SIZE,
    ),
  };
}

function normalizePositiveInteger(value, fallbackValue) {
  const parsedValue = Number.parseInt(String(value), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function safeJSONStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return '[Unserializable Value]';
  }
}

module.exports = {
  createConsoleCaptureRuntime,
};
