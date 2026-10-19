# Security and migration

Upgrade the SDK and Viewer together and rebuild iOS/Android. When `VIEWER_TOKEN` is omitted, the SDK uses the public shared default `rnv_default_pairing_token_for_local_dev_001`. A fresh Viewer uses the same default. Existing saved Viewer tokens are preserved; use **Settings → Security → Pairing token** to set a custom token or **Use default token**, then **Apply & restart**. Custom tokens must match `VIEWER_TOKEN` in the SDK. Explicit empty/invalid tokens leave capture disabled; the Viewer still rejects missing or incorrect bearer headers.

The SDK sends data to the configured Viewer URL; it has no built-in analytics/cloud upload. The Viewer defaults to localhost, permits explicit private LAN/subnet configuration and checks a pairing token. The shared default is public and does not restrict access to people who know this package. Set a private custom token when you need that restriction; MCP retains its own random token. The SDK accepts a user-configured URL, including WSS; it does not itself prove that a destination is physically on a LAN. Never put a custom token in a committed file, URL query or production configuration. Keep the setup in a local file covered by `.gitignore`.

## Privacy controls

Known credential headers, JSON keys and URL query parameters are redacted before transport: Authorization, Cookie, Set-Cookie, proxy authorization, access/refresh/ID tokens, passwords, secrets and API keys. Matching ignores case and separators. Console structured arguments and common key/value text patterns are also sanitized. Original application requests are not modified.

Optional bootstrap settings:

```js
bootRNNetworkDebugger({
  VIEWER_URL: localConfig.viewerUrl,
  VIEWER_TOKEN: localConfig.viewerToken,
  REDACT_SENSITIVE_DATA: true, // false: preserve raw credentials/data
  LIMIT_CAPTURE: true, // false: no application-defined capture limits
  CAPTURE_BODIES: false,
  CAPTURE_CONSOLE: false,
  REDACT_KEYS: ['email', 'phone'],
});
```

Both `REDACT_SENSITIVE_DATA` and `LIMIT_CAPTURE` default to `true`. They are independent; lower-level `startRNNetworkDebugger` / controller reconfiguration use `redactSensitiveData` and `limitCapture`. Viewer settings copy these values into setup; apply, copy the new setup and reload the app after a change. Previously redacted/truncated data cannot be recovered.

With limits enabled, transported body/text capture is capped at 65,536 characters; a fetch response clone may still be read in full before truncation. This is not a bound on the app’s total memory use. Recursive structures and collections are bounded. Oversized or incomplete structured text may be omitted. Redaction is **best effort**, particularly for arbitrary text, non-JSON bodies, encoded data and credentials with unknown names. It does not make captures safe to publish. Console output written by the app itself is unchanged. Disable capture for sensitive flows; inspect exports and AI-provider data policies.

With `LIMIT_CAPTURE: false`, SDK body/text and collection truncation, JS event/queue caps and native capture queue/envelope caps are bypassed. Set the matching Viewer switch off as well to remove receive rate/payload and retention limits. UI previews and transport batch splitting still work, without truncating stored bodies. OS memory/networking constraints still apply; OkHttp may reject outgoing queues above its own built-in limit. Cyclic values and unsupported binary formats still need serialization markers. Turning off redaction also bypasses `MASK_HEADERS` and `REDACT_KEYS`; this preserves the original captured values.

Tokens authenticate but do not encrypt `ws://` traffic. Use localhost/USB, a trusted LAN, or [Viewer WSS configuration](https://github.com/DevMobileAn27/rn_network_viewer/blob/main/docs/security.md#wss). Native TLS verification remains enabled; certificate trust must be configured on test devices. Do not ship permissive trust settings to production.

## Release builds

`devDependencies` alone does not remove JavaScript or native code from an APK/IPA.

- Keep SDK `require` and initialization inside `if (__DEV__)`. Runtime bootstrap fails closed when `__DEV__` is absent or false.
- Standard Android Debug contains the native capture module. Standard Release uses an empty ReactPackage and has no capture module/WebSocket client. The placeholder package can still be present in the artifact.
- iOS implementation files compile only when `DEBUG` is defined and true. The pod sets it for the standard `Debug` configuration. Ensure release configurations do not define `DEBUG=1`.
- Custom Android build types and custom iOS configurations must explicitly inherit the appropriate Debug/Release behavior. Verify them; no universal support claim is made.

To remove native autolinking completely, set `RNV_DISABLE_AUTOLINK=1` **throughout a clean release build**, including dependency configuration/code generation, `pod install` and Gradle/Xcode invocation. Use separate clean build workspaces for debug and release to avoid stale autolinking files. Confirm `react-native config` reports both platforms null, inspect generated package lists/Pods and inspect the final APK/IPA and JS bundle. The flag does not uninstall the npm package or guarantee that Metro removed all source strings.

The default guards prevent capture in standard release builds, but only inspecting the actual app artifact verifies full exclusion. See [verification details](verification.md). Do not treat a passing JavaScript test as proof about a production binary.
