const test = require('node:test');
const assert = require('node:assert/strict');

const {createConsoleCaptureRuntime} = require('./consoleCaptureRuntime');

function createFakeConsole() {
  const calls = [];

  const fakeConsole = {
    log(...args) {
      calls.push({level: 'log', args});
    },
    info(...args) {
      calls.push({level: 'info', args});
    },
    warn(...args) {
      calls.push({level: 'warn', args});
    },
    error(...args) {
      calls.push({level: 'error', args});
    },
    debug(...args) {
      calls.push({level: 'debug', args});
    },
  };

  return {calls, fakeConsole};
}

test('createConsoleCaptureRuntime emits structured console events without collapsing objects', () => {
  const {calls, fakeConsole} = createFakeConsole();
  const events = [];
  const runtime = createConsoleCaptureRuntime({
    getConsole: () => fakeConsole,
    emitEvent: event => {
      events.push(event);
    },
    createTimestamp: () => '2026-04-24T00:00:00.000Z',
  });

  runtime.start();

  fakeConsole.log('common changed:', {
    from: {
      Lang: 'vi',
      CommentPDF: false,
    },
    to: {
      Lang: 'vi',
      AutoTransfer: false,
    },
  });

  assert.deepEqual(calls, [
    {
      level: 'log',
      args: [
        'common changed:',
        {
          from: {
            Lang: 'vi',
            CommentPDF: false,
          },
          to: {
            Lang: 'vi',
            AutoTransfer: false,
          },
        },
      ],
    },
  ]);

  assert.deepEqual(events, [
    {
      level: 'log',
      source: 'js.console',
      timestamp: '2026-04-24T00:00:00.000Z',
      message: 'common changed: {"from":{"Lang":"vi","CommentPDF":false},"to":{"Lang":"vi","AutoTransfer":false}}',
      args: [
        {
          type: 'string',
          value: 'common changed:',
        },
        {
          type: 'object',
          value: {
            from: {
              Lang: 'vi',
              CommentPDF: false,
            },
            to: {
              Lang: 'vi',
              AutoTransfer: false,
            },
          },
        },
      ],
    },
  ]);
});

test('createConsoleCaptureRuntime restores original console methods on stop', () => {
  const {fakeConsole} = createFakeConsole();
  const originalLog = fakeConsole.log;
  const runtime = createConsoleCaptureRuntime({
    getConsole: () => fakeConsole,
    emitEvent() {},
  });

  runtime.start();
  assert.notEqual(fakeConsole.log, originalLog);

  runtime.stop();
  assert.equal(fakeConsole.log, originalLog);
});
