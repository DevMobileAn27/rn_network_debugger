const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const [pack] = JSON.parse(
  execFileSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    encoding: 'utf8',
  })
);
const files = pack.files.map((file) => file.path);
for (const required of [
  'privacyRuntime.js',
  'bootstrapRuntime.js',
  'react-native.config.js',
  'RNNetworkDebugger.podspec',
  'SECURITY.md',
  'docs/security.md',
  'android/src/debug/java/com/reactnativeviewer/rnvnetwork/RNVNetworkDevModule.kt',
  'android/src/release/java/com/reactnativeviewer/rnvnetwork/RNVNetworkDevPackage.kt',
])
  assert.ok(files.includes(required), `Missing ${required}`);
for (const file of files)
  assert.ok(
    !/(^|\/)(build|node_modules|\.gradle|\.env)(\/|$)|\.test\.js$|local\.properties$/.test(
      file
    ),
    `Unexpected package file ${file}`
  );
console.log(
  `Package contents checked: ${files.length} files, ${pack.unpackedSize} unpacked bytes.`
);
