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
    abort() { this.fail('abort'); }
    fail(type = 'error') {
      for (const handler of this.listeners.get(type) || []) handler();
      this[`on${type}`]?.();
    }
    complete() {
      this.status = 200;
      this.statusText = 'OK';
      this.responseText = '{"ok":true}';
      this.readyState = 4;
      for (const handler of this.listeners.get('readystatechange') || []) handler();
      this.onload?.();
    }
    getAllResponseHeaders() { return 'content-type: application/json'; }
  }
  // Like React Native's whatwg-fetch: creates and sends XHR synchronously,
  // then resolves asynchronously when the response arrives.
  const originalFetch = (url, init = {}) => {
    if (options.throwSync) throw new Error('sync failure');
    return new Promise((resolve, reject) => {
      const xhr = new FakeXHR();
      xhr.open(init.method || 'GET', url, true);
      xhr.onload = () => resolve({
        status: xhr.status,
        statusText: xhr.statusText,
        headers: {get: () => 'application/json', forEach: fn => fn('application/json', 'content-type')},
        clone: () => ({text: async () => xhr.responseText}),
      });
      xhr.onerror = xhr.onabort = () => reject(new Error('network failure'));
      xhr.send(init.body);
    });
  };
  const native = {
    configure() {}, setEnabled() {},
    captureEvents(batch) { events.push(...batch); },
  };
  const context = vm.createContext({
    NativeModules: {RNVNetworkDevModule: native},
    NativeEventEmitter: class {},
    Platform: {OS: platform}, __DEV__: true,
    XMLHttpRequest: FakeXHR, fetch: originalFetch,
    console, setTimeout, clearTimeout,
    require: () => ({createConsoleCaptureRuntime}),
  });
  context.global = context;
  const filename = path.join(process.env.RNV_TEST_SDK_ROOT || __dirname, platform, 'js/RNVNetworkCapture.js');
  const source = fs.readFileSync(filename, 'utf8')
    .replace(/^import .* from 'react-native';\n/, '')
    .replace(/export function /g, 'function ');
  vm.runInContext(source, context, {filename});
  const start = extra => context.startRNVNetworkCapture({
    captureConsole: false, maxBatchSize: 1,
    viewerURL: 'ws://127.0.0.1:38940/rnv/network', ...extra,
  });
  start(options.captureOptions);
  return {context, events, sent, start, FakeXHR};
}

for (const platform of ['android', 'ios']) {
  test(`${platform}: fetch using XHR produces exactly one request and response`, async () => {
    const {context, events, sent} = createRuntime(platform);
    const pending = context.fetch('https://example.com/api', {method: 'POST', body: 'payload'});
    assert.equal(sent.length, 1, 'only one underlying network call');
    sent[0].complete();
    const response = await pending;
    assert.equal(response.status, 200);
    assert.deepEqual(events.map(e => `${e.source}:${e.phase}`), ['js.fetch:request', 'js.fetch:response']);
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
    sent.forEach(request => request.complete());
    await Promise.all([a, b]);
    const requests = events.filter(e => e.phase === 'request');
    assert.deepEqual(requests.map(e => e.source), ['js.fetch', 'js.fetch', 'js.xhr']);
    assert.equal(new Set(requests.map(e => e.requestId)).size, 3);
    assert.equal(events.filter(e => e.phase === 'response').length, 3);
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
    assert.deepEqual(events.map(e => `${e.source}:${e.phase}`), [
      'js.fetch:request', 'js.fetch:error', 'js.xhr:request', 'js.xhr:response',
    ]);
  });

  test(`${platform}: synchronous fetch failure restores XHR capture`, async () => {
    const {context, events, FakeXHR} = createRuntime(platform, {throwSync: true});
    await assert.rejects(context.fetch('https://example.com/api'), /sync failure/);
    const xhr = new FakeXHR();
    xhr.open('GET', 'https://example.com/api', true);
    xhr.send();
    xhr.complete();
    assert.deepEqual(events.map(e => `${e.source}:${e.phase}`), [
      'js.fetch:request', 'js.fetch:error', 'js.xhr:request', 'js.xhr:response',
    ]);
  });

  test(`${platform}: XHR still captures fetch when fetch instrumentation is disabled`, async () => {
    const {context, events, sent} = createRuntime(platform, {captureOptions: {captureFetch: false}});
    const pending = context.fetch('https://example.com/api');
    sent[0].complete();
    await pending;
    assert.deepEqual(events.map(e => `${e.source}:${e.phase}`), ['js.xhr:request', 'js.xhr:response']);
  });

  test(`${platform}: stop and restart do not stack network wrappers`, async () => {
    const {context, events, sent, start} = createRuntime(platform);
    context.stopRNVNetworkCapture();
    start();
    start();
    const pending = context.fetch('https://example.com/api');
    sent[0].complete();
    await pending;
    assert.deepEqual(events.map(e => `${e.source}:${e.phase}`), ['js.fetch:request', 'js.fetch:response']);
  });
}
