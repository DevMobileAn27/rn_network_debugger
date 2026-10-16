const test = require('node:test');
const assert = require('node:assert/strict');
const {redactValue, sanitizeCaptureEvent} = require('./privacyRuntime');

test('redacts nested keys, JSON strings, URLs and console fragments', () => {
  const input = {
    headers: {Authorization: 'Bearer abc123', Cookie: 'sid=private'},
    body: JSON.stringify({
      password: 'private',
      access_token: 'private',
      items: [{clientSecret: 'private', ok: 1}],
    }),
    url: 'https://example.com?access%5Ftoken=private&ok=1',
    message: 'Login: {"password":"private","nested":{"token":"private"}}',
    custom: {email: 'private'},
  };
  const result = redactValue(input, ['email']);
  assert.ok(!JSON.stringify(result).includes('private'));
  assert.ok(!JSON.stringify(result).includes('abc123'));
  assert.equal(JSON.parse(result.body).items[0].ok, 1);
  assert.ok(input.body.includes('private'), 'original request is unchanged');
});

test('body opt-out, cycles, malformed JSON and oversized values are bounded', () => {
  const cycle = {};
  cycle.self = cycle;
  assert.equal(redactValue(cycle).self, '[Omitted]');
  assert.equal(
    redactValue('{"password":"private'),
    '[Omitted: incomplete structured text]'
  );
  assert.equal(
    redactValue('x'.repeat(1024 * 1024 + 1)),
    '[Omitted: oversized text]'
  );
  assert.ok(redactValue('x'.repeat(100000)).length <= 65537);
  let nested = 'value';
  for (let i = 0; i < 15; i++) nested = JSON.stringify({value: nested});
  assert.ok(JSON.stringify(redactValue(nested)).length < nested.length);
  const safe = sanitizeCaptureEvent(
    {request: {body: 'body', bodyPreview: 'preview'}, response: {body: 'body'}},
    {captureBodies: false}
  );
  assert.equal(safe.request.body, null);
  assert.equal(safe.request.bodyPreview, null);
  assert.equal(safe.response.body, null);
});

for (const redacting of [true, false]) {
  for (const limited of [true, false]) {
    test(`privacy options are independent: redact=${redacting}, limit=${limited}`, () => {
      const original = {
        request: {
          headers: {Authorization: 'Bearer private'},
          body: JSON.stringify({
            password: 'private',
            text: 'x'.repeat(80000),
            items: Array.from({length: 150}, (_, i) => i),
          }),
        },
      };
      const safe = sanitizeCaptureEvent(original, {
        redactSensitiveData: redacting,
        limitCapture: limited,
      });
      assert.equal(
        safe.request.headers.Authorization,
        redacting ? '[REDACTED]' : 'Bearer private'
      );
      if (limited) assert.ok(safe.request.body.length <= 65537);
      else {
        const body = JSON.parse(safe.request.body);
        assert.equal(body.text.length, 80000);
        assert.equal(body.items.length, 150);
        assert.equal(body.password, redacting ? '[REDACTED]' : 'private');
      }
      assert.equal(original.request.headers.Authorization, 'Bearer private');
    });
  }
}
