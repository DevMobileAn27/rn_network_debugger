# Changelog

## 0.4.7 — 2026-10-16

- Add independent `REDACT_SENSITIVE_DATA` / `LIMIT_CAPTURE` bootstrap options (`redactSensitiveData` / `limitCapture` at runtime), both defaulting to true.

Breaking: Viewer pairing token required (`VIEWER_TOKEN` / `viewerToken`). Upgrade Viewer and SDK together; copy setup from Viewer Security settings. No fallback to unauthenticated connections.

- Redact common secrets in headers, nested JSON, URLs and logs before transport; add body opt-out and custom redaction keys.
- Bound captured text/events and native queues; isolate debug transport failures from app fetch/console.
- Keep capture implementations out of standard native Release builds; add optional autolinking exclusion.
- Add security policy, package checks, native build checks and a manually triggered npm trusted-publishing workflow.
