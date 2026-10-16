const DEFAULT_REDACT_KEYS = Object.freeze([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'password',
  'passwd',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'secret',
  'client_secret',
  'api_key',
  'x-api-key',
  'x-access-token',
]);
const MAX_CAPTURE_CHARACTERS = 65536;
const normalizeKey = (key) =>
  String(key)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

function redactValue(
  value,
  extraKeys = [],
  depth = 0,
  seen = new WeakSet(),
  options = {}
) {
  const limited = options.limitCapture !== false;
  const redacting = options.redactSensitiveData !== false;
  const keys = new Set(
    [...DEFAULT_REDACT_KEYS, ...extraKeys].map(normalizeKey)
  );
  const keyPattern = [...keys]
    .filter(Boolean)
    .map((key) => key.split('').join('[ _-]*'))
    .join('|');
  const assignments = new RegExp(
    `([\"']?\\b(?:${keyPattern})[\"']?\\s*[:=]\\s*)(\"[^\"]*\"|'[^']*'|[^\\s,;&}]+)`,
    'gi'
  );
  let remaining = 2048;
  function text(input, level) {
    if (limited && level >= 8) return '[Omitted]';
    // Redact structured text before truncating so incomplete JSON cannot expose fields.
    if (limited && input.length > 1024 * 1024)
      return '[Omitted: oversized text]';
    const trimmed = input.trim();
    if (redacting && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
      try {
        const structured = JSON.stringify(walk(JSON.parse(input), level + 1));
        return limited && structured.length > MAX_CAPTURE_CHARACTERS
          ? `${structured.slice(0, MAX_CAPTURE_CHARACTERS)}…`
          : structured;
      } catch (_) {
        return '[Omitted: incomplete structured text]';
      }
    }
    const result = !redacting
      ? input
      : input
          .replace(/([?&])([^=&#\s]+)=([^&#\s]*)/g, (all, sep, key) => {
            let decoded;
            try {
              decoded = decodeURIComponent(key);
            } catch (_) {
              return `${sep}${key}=[REDACTED]`;
            }
            return keys.has(normalizeKey(decoded))
              ? `${sep}${key}=[REDACTED]`
              : all;
          })
          .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_=.~-]+/gi, '$1 [REDACTED]')
          .replace(
            assignments,
            (_, prefix, value) =>
              `${prefix}${
                value.startsWith('"') ? '"[REDACTED]"' : '[REDACTED]'
              }`
          );
    return limited && result.length > MAX_CAPTURE_CHARACTERS
      ? `${result.slice(0, MAX_CAPTURE_CHARACTERS)}…`
      : result;
  }
  function walk(item, level) {
    if (limited && --remaining < 0) return '[Omitted]';
    if (typeof item === 'string') return text(item, level);
    if (item == null || typeof item !== 'object') return item;
    if ((limited && level >= 8) || seen.has(item)) return '[Omitted]';
    seen.add(item);
    try {
      if (Array.isArray(item))
        return item
          .slice(0, limited ? 100 : undefined)
          .map((v) => walk(v, level + 1));
      const result = {};
      for (const key of Object.keys(item).slice(0, limited ? 100 : undefined)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype')
          continue;
        result[key] =
          redacting && keys.has(normalizeKey(key))
            ? '[REDACTED]'
            : walk(item[key], level + 1);
      }
      return result;
    } finally {
      seen.delete(item);
    }
  }
  return walk(value, depth);
}

function sanitizeCaptureEvent(event, options = {}) {
  const safe = redactValue(
    event,
    options.redactKeys || [],
    0,
    new WeakSet(),
    options
  );
  for (const key of ['request', 'response']) {
    if (safe[key] && options.captureBodies === false) {
      safe[key].body = null;
      safe[key].bodyPreview = null;
    }
  }
  return safe;
}
module.exports = {
  DEFAULT_REDACT_KEYS,
  MAX_CAPTURE_CHARACTERS,
  redactValue,
  sanitizeCaptureEvent,
};
