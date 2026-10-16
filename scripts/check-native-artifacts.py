"""Check library AARs, not final consumer APK/IPA exclusion."""
import io
import sys
import zipfile
from pathlib import Path

root = Path(sys.argv[1])

def classes(variant):
    with zipfile.ZipFile(root / f'sdk-{variant}.aar') as aar:
        with zipfile.ZipFile(io.BytesIO(aar.read('classes.jar'))) as jar:
            return set(jar.namelist())

debug = classes('debug')
release = classes('release')
prefix = 'com/reactnativeviewer/rnvnetwork/'
assert prefix + 'RNVNetworkDevModule.class' in debug
assert prefix + 'RNVNetworkDevWebSocketClient.class' in debug
assert prefix + 'RNVNetworkDevPackage.class' in release
assert not any('RNVNetworkDevModule' in name or 'RNVNetworkDevWebSocketClient' in name for name in release)
print('Debug AAR includes capture; Release AAR contains only the no-op package (plus metadata).')
