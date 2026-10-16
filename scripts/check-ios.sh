#!/usr/bin/env bash
set -euo pipefail
sdk_root="$(cd "$(dirname "$0")/.." && pwd)"
: "${RNV_REACT_NATIVE_ROOT:?Set RNV_REACT_NATIVE_ROOT to an installed react-native directory}"
check_dir="$(mktemp -d)"
trap 'rm -rf "$check_dir"' EXIT
mkdir -p "$check_dir/React" "$check_dir/RCTDeprecation"
# Reproduce React-Core's public header mapping for compile checks only.
python3 - "$RNV_REACT_NATIVE_ROOT" "$check_dir" <<'PY'
from pathlib import Path
import sys
root, target = map(Path, sys.argv[1:])
for header in (root / 'React').rglob('*.h'):
    link = target / 'React' / header.name
    if not link.exists(): link.symlink_to(header.resolve())
for header in root.rglob('RCTDeprecation.h'):
    (target / 'RCTDeprecation' / header.name).symlink_to(header.resolve())
PY
for source in "$sdk_root"/ios/native/*.m; do
  xcrun --sdk iphonesimulator clang -c -fobjc-arc -fmodules -DDEBUG=1 \
    -target arm64-apple-ios15.1-simulator -isysroot "$(xcrun --sdk iphonesimulator --show-sdk-path)" \
    -I "$check_dir" "$source" -o "$check_dir/$(basename "$source").debug.o"
  xcrun --sdk iphonesimulator clang -c -fobjc-arc -DDEBUG=0 \
    -target arm64-apple-ios15.1-simulator -isysroot "$(xcrun --sdk iphonesimulator --show-sdk-path)" \
    "$source" -o "$check_dir/$(basename "$source").release.o"
done
xcrun nm "$check_dir"/*.debug.o > "$check_dir/debug-symbols.txt"
xcrun nm "$check_dir"/*.release.o > "$check_dir/release-symbols.txt"
python3 - "$check_dir" <<'PY'
from pathlib import Path
import sys
root = Path(sys.argv[1])
assert 'OBJC_CLASS_$_RNVNetworkDevModule' in (root / 'debug-symbols.txt').read_text()
assert 'OBJC_CLASS_$_RNVNetwork' not in (root / 'release-symbols.txt').read_text()
print('iOS Debug objects contain capture; DEBUG=0 objects contain no capture classes.')
PY
