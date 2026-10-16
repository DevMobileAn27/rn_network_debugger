#!/usr/bin/env bash
set -euo pipefail
sdk_root="$(cd "$(dirname "$0")/.." && pwd)"
check_dir="$(mktemp -d)"
trap 'rm -rf "$check_dir"' EXIT
cp -R "$sdk_root/android" "$check_dir/sdk"
cat > "$check_dir/settings.gradle" <<'GRADLE'
rootProject.name = 'rnv-native-check'
include ':sdk'
GRADLE
cat > "$check_dir/build.gradle" <<'GRADLE'
buildscript {
  repositories { google(); mavenCentral() }
  dependencies {
    classpath 'com.android.tools.build:gradle:8.8.2'
    classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21'
  }
}
ext.compileSdkVersion = 35
subprojects {
  configurations.configureEach {
    resolutionStrategy.force 'com.facebook.react:react-android:0.79.7'
  }
}
GRADLE
printf 'android.useAndroidX=true\n' > "$check_dir/gradle.properties"
"${RNV_GRADLE:-gradle}" -p "$check_dir" :sdk:assembleDebug :sdk:assembleRelease
python3 "$sdk_root/scripts/check-native-artifacts.py" "$check_dir/sdk/build/outputs/aar"
