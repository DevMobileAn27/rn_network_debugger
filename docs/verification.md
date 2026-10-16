# Verification and release evidence

The declared peer range is React Native >=0.74. That is not a claim that every RN version, architecture, networking adapter or custom native build configuration has passed testing.

| Check | Scope |
| --- | --- |
| `npm test` | Node tests for bootstrap, Android/iOS JS wrappers, redaction, token forwarding, body opt-out, fetch/XHR deduplication and transport failures |
| `npm run check:package` | Published-file allowlist and required runtime/security files |
| `bash scripts/check-android.sh` | Compiles library Debug/Release AARs against RN 0.79.7; inspects class lists to ensure Release has no capture module/client |
| `RNV_REACT_NATIVE_ROOT=... bash scripts/check-ios.sh` | Compiles Objective-C Debug/Release objects against installed RN headers; inspects capture class symbols |
| Viewer `flutter test` | Real WebSocket/MCP connections, invalid credentials/headers/subnets, resource limits and WSS certificate trust |

Native scripts are library-level checks. They do not build or inspect a consumer APK/IPA, test device networking, prove autolinking compatibility across all RN versions, or certify compatibility with the New Architecture. Full example-app builds/device smoke tests for the RN versions you support remain release requirements. CI results must be checked for the exact tag/commit, not inferred from the presence of a workflow file.

## Local verification for this change (2026-10-16)

- 42 Node tests passed; npm package contents check passed.
- Android Debug/Release library builds and AAR class inspection passed against RN 0.79.7.
- iOS Debug/Release object compilation and symbol inspection passed against locally installed RN headers; Android CLI autolinking resolved the relocated package.
- Viewer analysis and 58 tests passed, including WSS trust and local LAN-interface access; macOS arm64 release build passed.
- Windows build, full consumer APK/IPA inspection, physical-device pairing and remote GitHub workflows have not been run for this change. These results do not constitute an independent audit.

## Trusted publishing

The manual `publish.yml` workflow is prepared but requires maintainer setup before it can publish:

1. On npm, configure this repository as the trusted GitHub publisher, workflow `publish.yml`, environment `npm`.
2. In GitHub, create the `npm` environment with required reviewers/restricted release tags; enable private vulnerability reporting and branch protection.
3. Review and pass SDK/native CI checks, bump package/podspec/native metadata versions together, commit, and create a matching `vX.Y.Z` tag.
4. Dispatch **Publish npm (trusted publisher)** with that version. It verifies the tag's package version and requests npm provenance using OIDC, without storing a long-lived npm token.
5. Verify registry provenance, package contents and changelog after publishing. Provenance links a package to a build; it is not a security audit.

No workflow has been run remotely or package published as part of these source changes. Signing desktop binaries/notarization needs separate Apple/Microsoft certificate configuration in the Viewer repository.
