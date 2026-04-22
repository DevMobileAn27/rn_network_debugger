export type RuntimePlatform = 'ios' | 'android';

export type RNVNetworkCaptureOptions = {
  enabled?: boolean;
  viewerURL?: string;
  captureFetch?: boolean;
  captureXMLHttpRequest?: boolean;
  maxBodyPreviewCharacters?: number;
  maxBatchSize?: number;
  flushIntervalMs?: number;
  maskHeaders?: string[];
};

export type RNNetworkDebuggerController = {
  reason?: string;
  stop(): void;
  reconfigure(nextOptions?: Partial<RNVNetworkCaptureOptions>): void;
};

export type RNNetworkDebuggerSubscription = {
  remove(): void;
};

export type RNNetworkDebuggerStatusEvent = Record<string, unknown>;

export type RNNetworkDebuggerListener = (
  event: RNNetworkDebuggerStatusEvent,
) => void;

export type RNNetworkDebuggerConfig = {
  VIEWER_HOST?: string;
  VIEWER_PATH?: string;
  VIEWER_PORT?: number;
  VIEWER_URL?: string;
  MAX_BODY_PREVIEW_CHARACTERS?: number;
  MASK_HEADERS?: string[];
  CAPTURE_FETCH?: boolean;
  CAPTURE_XML_HTTP_REQUEST?: boolean;
  MAX_BATCH_SIZE?: number;
  FLUSH_INTERVAL_MS?: number;
  viewerHost?: string;
  viewerPath?: string;
  viewerPort?: number;
  viewerURL?: string;
  maxBodyPreviewCharacters?: number;
  maskHeaders?: string[];
  captureFetch?: boolean;
  captureXMLHttpRequest?: boolean;
  maxBatchSize?: number;
  flushIntervalMs?: number;
};

export type NormalizedRNNetworkDebuggerConfig = {
  viewerHost: string | null;
  viewerPath: string;
  viewerPort: number;
  viewerURL: string | null;
  maxBodyPreviewCharacters: number;
  maskHeaders: string[];
  captureFetch?: boolean;
  captureXMLHttpRequest?: boolean;
  maxBatchSize?: number;
  flushIntervalMs?: number;
};

export type RNNetworkDebuggerResolveInput = {
  platform?: RuntimePlatform;
  scriptURL?: string | null;
  config?: RNNetworkDebuggerConfig;
};

export declare const DEFAULT_MASK_HEADERS: readonly string[];
export declare const DEFAULT_MAX_BODY_PREVIEW_CHARACTERS: number;
export declare const DEFAULT_VIEWER_PATH: string;
export declare const DEFAULT_VIEWER_PORT: number;

export declare function defineRNNetworkDebuggerConfig<T extends RNNetworkDebuggerConfig>(
  config: T,
): T;

export declare function normalizeRNNetworkDebuggerConfig(
  config?: RNNetworkDebuggerConfig,
): NormalizedRNNetworkDebuggerConfig;

export declare function resolveRNNetworkDebuggerViewerHost(
  input?: RNNetworkDebuggerResolveInput,
): string;

export declare function resolveRNNetworkDebuggerViewerURL(
  input?: RNNetworkDebuggerResolveInput,
): string;

export declare function bootRNNetworkDebugger(
  config?: RNNetworkDebuggerConfig,
): RNNetworkDebuggerController | null;

export declare function stopRNNetworkDebuggerBootstrap(): void;

export declare function addRNNetworkDebuggerListener(
  listener: RNNetworkDebuggerListener,
): RNNetworkDebuggerSubscription;

export declare function createRNNetworkDebuggerController(
  options?: RNVNetworkCaptureOptions,
): RNNetworkDebuggerController;

export declare function startRNNetworkDebugger(
  options?: RNVNetworkCaptureOptions,
): RNNetworkDebuggerController;

export declare function stopRNNetworkDebugger(): void;

export declare function addRNVNetworkListener(
  listener: RNNetworkDebuggerListener,
): RNNetworkDebuggerSubscription;

export declare function createRNVNetworkCaptureController(
  options?: RNVNetworkCaptureOptions,
): RNNetworkDebuggerController;

export declare function startRNVNetworkCapture(
  options?: RNVNetworkCaptureOptions,
): RNNetworkDebuggerController;

export declare function stopRNVNetworkCapture(): void;

export declare function bootRNVNetworkCapture(
  config?: RNNetworkDebuggerConfig,
): RNNetworkDebuggerController | null;

export declare function resolveRNVViewerHost(
  input?: RNNetworkDebuggerResolveInput,
): string;

export declare function resolveRNVViewerURL(
  input?: RNNetworkDebuggerResolveInput,
): string;

export declare function stopRNVNetworkCaptureBootstrap(): void;

declare const RNNetworkDebugger: {
  addRNNetworkDebuggerListener: typeof addRNNetworkDebuggerListener;
  createRNNetworkDebuggerController: typeof createRNNetworkDebuggerController;
  bootRNNetworkDebugger: typeof bootRNNetworkDebugger;
  DEFAULT_MASK_HEADERS: typeof DEFAULT_MASK_HEADERS;
  DEFAULT_MAX_BODY_PREVIEW_CHARACTERS: typeof DEFAULT_MAX_BODY_PREVIEW_CHARACTERS;
  DEFAULT_VIEWER_PATH: typeof DEFAULT_VIEWER_PATH;
  DEFAULT_VIEWER_PORT: typeof DEFAULT_VIEWER_PORT;
  defineRNNetworkDebuggerConfig: typeof defineRNNetworkDebuggerConfig;
  normalizeRNNetworkDebuggerConfig: typeof normalizeRNNetworkDebuggerConfig;
  resolveRNNetworkDebuggerViewerHost: typeof resolveRNNetworkDebuggerViewerHost;
  resolveRNNetworkDebuggerViewerURL: typeof resolveRNNetworkDebuggerViewerURL;
  startRNNetworkDebugger: typeof startRNNetworkDebugger;
  stopRNNetworkDebugger: typeof stopRNNetworkDebugger;
  stopRNNetworkDebuggerBootstrap: typeof stopRNNetworkDebuggerBootstrap;
  addRNVNetworkListener: typeof addRNVNetworkListener;
  createRNVNetworkCaptureController: typeof createRNVNetworkCaptureController;
  bootRNVNetworkCapture: typeof bootRNVNetworkCapture;
  resolveRNVViewerHost: typeof resolveRNVViewerHost;
  resolveRNVViewerURL: typeof resolveRNVViewerURL;
  startRNVNetworkCapture: typeof startRNVNetworkCapture;
  stopRNVNetworkCapture: typeof stopRNVNetworkCapture;
  stopRNVNetworkCaptureBootstrap: typeof stopRNVNetworkCaptureBootstrap;
};

export default RNNetworkDebugger;
