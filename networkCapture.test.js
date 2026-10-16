const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {createConsoleCaptureRuntime} = require('./consoleCaptureRuntime');

function createRuntime(platform, options = {}) {
  const events = [];
  const sent = [];
  class FakeXHR {
    constructor() {
      this.listeners = new Map();
      this.readyState = 0;
      this.responseType = '';
    }
    open(method, url) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader() {}
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(handler);
    }
    removeEventListener(type, handler) {
      this.listeners.get(type)?.delete(handler);
    }
    send(body) {
      this.body = body;
      sent.push(this);
    }
    abort() {
      this.fail('abort');
    }
    fail(type = 'error') {
      for (const handler of this.listeners.get(type) || []) handler();
      this[`on${type}`]?.();
    }
    complete() {
      this.status = 200;
      this.statusText = 'OK';
      this.responseText = '{"ok":true}';
      this.readyState = 4;
      for (const handler of this.listeners.get('readystatechange') || [])
        handler();
      this.onload?.();
    }
    getAllResponseHeaders() {
      return 'content-type: application/json';
    }
  }
  // Like React Native's whatwg-fetch: creates and sends XHR synchronously,
  // then resolves asynchronously when the response arrives.
  const originalFetch = (url, init = {}) => {
    if (options.throwSync) throw new Error('sync failure');
    return new Promise((resolve, reject) => {
      const xhr = new FakeXHR();
      xhr.open(init.method || 'GET', url, true);
      xhr.onload = () =>
        resolve({
          status: xhr.status,
          statusText: xhr.statusText,
          headers: {
            get: () => 'application/json',
            forEach: (fn) => fn('application/json', 'content-type'),
          },
          clone: () => ({
            text: () =>
              options.bodyPromise ||
              Promise.resolve(options.responseBody ?? xhr.responseText),
          }),
        });
      xhr.onerror = xhr.onabort = () => reject(new Error('network failure'));
      xhr.send(init.body);
    });
  };
  const configurations = [];
  const native = {
    configure(value) {
      if (options.configureThrows) throw Error('unavailable');
      configurations.push(value);
    },
    setEnabled() {},
    captureEvents(batch) {
      if (options.captureThrows) throw Error('unavailable');
      events.push(...batch);
    },
  };
  const context = vm.createContext({
    NativeModules: {RNVNetworkDevModule: native},
    NativeEventEmitter: class {},
    Platform: {OS: platform},
    __DEV__: options.dev !== false,
    XMLHttpRequest: FakeXHR,
    fetch: originalFetch,
    console,
    setTimeout,
    clearTimeout,
    require: (name) =>
      name.includes('privacyRuntime')
        ? require('./privacyRuntime')
        : {createConsoleCaptureRuntime},
  });
  context.global = context;
  const filename = path.join(
    process.env.RNV_TEST_SDK_ROOT || __dirname,
    platform,
    'js/RNVNetworkCapture.js'
  );
  const source = fs
    .readFileSync(filename, 'utf8')
    .replace(/^import .* from 'react-native';\n/, '')
    .replace(/export function /g, 'function ');
  vm.runInContext(source, context, {filename});
  const start = (extra) =>
    context.startRNVNetworkCapture({
      captureConsole: false,
      maxBatchSize: 1,
      viewerURL: 'ws://127.0.0.1:38940/rnv/network',
      viewerToken: 'a'.repeat(43),
      ...extra,
    });
  start(options.captureOptions);
  return {context, events, sent, start, FakeXHR, configurations};
}

for (const platform of ['android', 'ios']) {
  test(`${platform}: fetch using XHR produces exactly one request and response`, async () => {
    const {context, events, sent} = createRuntime(platform);
    const pending = context.fetch('https://example.com/api', {
      method: 'POST',
      body: 'payload',
    });
    assert.equal(sent.length, 1, 'only one underlying network call');
    sent[0].complete();
    const response = await pending;
    await new Promise(setImmediate);
    assert.equal(response.status, 200);
    assert.deepEqual(
      events.map((e) => `${e.source}:${e.phase}`),
      ['js.fetch:request', 'js.fetch:response']
    );
    assert.equal(events[0].requestId, events[1].requestId);
    assert.equal(events[0].request.body, 'payload');
    assert.equal(events[1].response.body, '{"ok":true}');
  });

  test(`${platform}: concurrent same-URL fetch and direct XHR remain distinct`, async () => {
    const {context, events, sent, FakeXHR} = createRuntime(platform);
    const a = context.fetch('https://example.com/api');
    const b = context.fetch('https://example.com/api');
    const xhr = new FakeXHR();
    xhr.open('GET', 'https://example.com/api', true);
    xhr.send();
    assert.equal(sent.length, 3);
    sent.forEach((request) => request.complete());
    await Promise.all([a, b]);
    await new Promise(setImmediate);
    const requests = events.filter((e) => e.phase === 'request');
    assert.deepEqual(
      requests.map((e) => e.source),
      ['js.fetch', 'js.fetch', 'js.xhr']
    );
    assert.equal(new Set(requests.map((e) => e.requestId)).size, 3);
    assert.equal(events.filter((e) => e.phase === 'response').length, 3);
  });

  test(`${platform}: rejected fetch emits one error and later direct XHR is captured`, async () => {
    const {context, events, sent, FakeXHR} = createRuntime(platform);
    const pending = context.fetch('https://example.com/api');
    sent[0].fail();
    await assert.rejects(pending, /network failure/);
    const xhr = new FakeXHR();
    xhr.open('GET', 'https://example.com/api', true);
    xhr.send();
    xhr.complete();
    assert.deepEqual(
      events.map((e) => `${e.source}:${e.phase}`),
      [
        'js.fetch:request',
        'js.fetch:error',
        'js.xhr:request',
        'js.xhr:response',
      ]
    );
  });

  test(`${platform}: synchronous fetch failure restores XHR capture`, async () => {
    const {context, events, FakeXHR} = createRuntime(platform, {
      throwSync: true,
    });
    await assert.rejects(
      context.fetch('https://example.com/api'),
      /sync failure/
    );
    const xhr = new FakeXHR();
    xhr.open('GET', 'https://example.com/api', true);
    xhr.send();
    xhr.complete();
    assert.deepEqual(
      events.map((e) => `${e.source}:${e.phase}`),
      [
        'js.fetch:request',
        'js.fetch:error',
        'js.xhr:request',
        'js.xhr:response',
      ]
    );
  });

  test(`${platform}: XHR still captures fetch when fetch instrumentation is disabled`, async () => {
    const {context, events, sent} = createRuntime(platform, {
      captureOptions: {captureFetch: false},
    });
    const pending = context.fetch('https://example.com/api');
    sent[0].complete();
    await pending;
    await new Promise(setImmediate);
    assert.deepEqual(
      events.map((e) => `${e.source}:${e.phase}`),
      ['js.xhr:request', 'js.xhr:response']
    );
  });

  test(`${platform}: stop and restart do not stack network wrappers`, async () => {
    const {context, events, sent, start} = createRuntime(platform);
    context.stopRNVNetworkCapture();
    start();
    start();
    const pending = context.fetch('https://example.com/api');
    sent[0].complete();
    await pending;
    await new Promise(setImmediate);
    assert.deepEqual(
      events.map((e) => `${e.source}:${e.phase}`),
      ['js.fetch:request', 'js.fetch:response']
    );
  });
}

for (const platform of ['android', 'ios']) {
  test(`${platform}: missing token and release build do not install capture`, async () => {
    for (const options of [{captureOptions: {viewerToken: ''}}, {dev: false}]) {
      const {context, configurations, sent, events} = createRuntime(
        platform,
        options
      );
      const pending = context.fetch('https://example.com');
      sent[0].complete();
      await pending;
      assert.equal(configurations.length, 0);
      assert.equal(events.length, 0);
    }
  });
  test(`${platform}: token forwarded and secrets redacted without changing actual body`, async () => {
    const {context, configurations, sent, events} = createRuntime(platform);
    const body = JSON.stringify({
      password: 'secret123',
      nested: {token: 'abc', ok: true},
    });
    const pending = context.fetch('https://example.com?access_token=abc', {
      method: 'POST',
      body,
    });
    assert.equal(sent[0].body, body);
    assert.equal(
      configurations[0].connectionHeaders.Authorization,
      `Bearer ${'a'.repeat(43)}`
    );
    assert.ok(!JSON.stringify(events).includes('secret123'));
    assert.ok(!JSON.stringify(events).includes('abc'));
    sent[0].complete();
    await pending;
    await new Promise(setImmediate);
  });
  test(`${platform}: disabled bodies and native failures preserve fetch`, async () => {
    for (const options of [
      {captureOptions: {captureBodies: false}},
      {captureThrows: true},
      {configureThrows: true},
    ]) {
      const {context, events, sent} = createRuntime(platform, options);
      const pending = context.fetch('https://example.com', {
        body: 'secret body',
      });
      sent[0].complete();
      assert.equal((await pending).status, 200);
      await new Promise(setImmediate);
      assert.ok(!JSON.stringify(events).includes('secret body'));
      context.stopRNVNetworkCapture();
    }
  });
  test(`${platform}: slow capture body never delays application fetch`, async () => {
    const {context, sent} = createRuntime(platform, {
      bodyPromise: new Promise(() => {}),
    });
    const pending = context.fetch('https://example.com');
    sent[0].complete();
    assert.equal((await pending).status, 200);
    context.stopRNVNetworkCapture();
  });
}

for (const platform of ['android', 'ios']) {
  test(`${platform}: late body from a previous pairing is dropped`, async () => {
    let releaseBody;
    const bodyPromise = new Promise((resolve) => {
      releaseBody = resolve;
    });
    const {context, events, sent, start} = createRuntime(platform, {
      bodyPromise,
    });
    const pending = context.fetch('https://example.com/old');
    sent[0].complete();
    await pending;
    context.stopRNVNetworkCapture();
    start();
    releaseBody('{"oldSession":true}');
    await new Promise(setImmediate);
    assert.equal(
      events.filter((event) => event.phase === 'response').length,
      0
    );
    context.stopRNVNetworkCapture();
  });
}

for (const platform of ['android', 'ios']) {
  test(`${platform}: unlimited unredacted mode preserves full body and headers end to end`, async () => {
    const {context, events, sent, configurations, start} = createRuntime(
      platform,
      {
        captureOptions: {redactSensitiveData: false, limitCapture: false},
        responseBody: 'response'.repeat(100000),
      }
    );
    const body = JSON.stringify({
      token: 'private',
      text: 'x'.repeat(600000),
      values: Array.from({length: 150}, (_, i) => i),
    });
    const pending = context.fetch('https://example.com?token=private', {
      body,
      headers: {Authorization: 'Bearer private'},
    });
    sent[0].complete();
    await pending;
    await new Promise(setImmediate);
    assert.equal(configurations[0].limitCapture, false);
    assert.equal(
      events.find((e) => e.phase === 'response').response.body,
      'response'.repeat(100000)
    );
    assert.equal(events[0].request.body, body);
    assert.equal(events[0].request.headers.Authorization, 'Bearer private');
    assert.equal(events[0].request.url, 'https://example.com?token=private');
    const controller = start({redactSensitiveData: true, limitCapture: false});
    const second = context.fetch('https://example.com?token=private', {body});
    sent[1].complete();
    await second;
    await new Promise(setImmediate);
    const request = events.filter((e) => e.phase === 'request')[1].request;
    assert.equal(JSON.parse(request.body).text.length, 600000);
    assert.equal(JSON.parse(request.body).token, '[REDACTED]');
    controller.stop();
  });
}
