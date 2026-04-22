#import "RNVNetworkDevModule.h"

#import <TargetConditionals.h>
#import <UIKit/UIKit.h>

#import "RNVNetworkDevWebSocketClient.h"

static NSString * const RNVNetworkDevStatusEventName = @"RNVNetworkDevStatus";
static NSString * const RNVNetworkDevSDKVersion = @"0.1.0";

@interface RNVNetworkDevModule ()

@property (nonatomic, strong) RNVNetworkDevWebSocketClient *client;
@property (nonatomic, assign) BOOL hasListeners;
@property (nonatomic, assign) BOOL sdkEnabled;
@property (nonatomic, copy) NSString *sessionIdentifier;

@end

@implementation RNVNetworkDevModule

RCT_EXPORT_MODULE(RNVNetworkDevModule)

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _client = [RNVNetworkDevWebSocketClient new];
        _sdkEnabled = YES;
        _sessionIdentifier = [[NSUUID UUID] UUIDString];

        __weak typeof(self) weakSelf = self;
        _client.statusHandler = ^(NSString *state, NSString * _Nullable detail) {
            __strong typeof(weakSelf) strongSelf = weakSelf;
            if (strongSelf == nil) {
                return;
            }

            [strongSelf emitStatus:state detail:detail];
        };
    }

    return self;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[RNVNetworkDevStatusEventName];
}

- (NSDictionary<NSString *, id> *)constantsToExport {
    return @{
        @"statusEventName": RNVNetworkDevStatusEventName,
        @"sdkVersion": RNVNetworkDevSDKVersion,
    };
}

RCT_EXPORT_METHOD(configure:(NSDictionary *)options) {
    self.sdkEnabled = [options[@"enabled"] respondsToSelector:@selector(boolValue)] ? [options[@"enabled"] boolValue] : YES;

    if (!self.sdkEnabled) {
        [self.client disconnectAndClearQueue];
        [self emitStatus:@"disabled" detail:@"SDK disabled by configuration."];
        return;
    }

    NSString *viewerURL = [options[@"viewerURL"] isKindOfClass:[NSString class]] ? options[@"viewerURL"] : nil;
    NSInteger maxQueueSize = [options[@"maxQueueSize"] respondsToSelector:@selector(integerValue)] ? [options[@"maxQueueSize"] integerValue] : 200;
    NSDictionary<NSString *, NSString *> *connectionHeaders = [options[@"connectionHeaders"] isKindOfClass:[NSDictionary class]] ? options[@"connectionHeaders"] : @{};

    [self.client configureWithURLString:viewerURL maxQueueSize:maxQueueSize connectionHeaders:connectionHeaders];
}

RCT_EXPORT_METHOD(setEnabled:(BOOL)enabled) {
    self.sdkEnabled = enabled;
    if (!enabled) {
        [self.client disconnectAndClearQueue];
        [self emitStatus:@"disabled" detail:@"SDK disabled at runtime."];
    }
}

RCT_EXPORT_METHOD(captureEvent:(NSDictionary *)event) {
    [self captureEvents:@[event]];
}

RCT_EXPORT_METHOD(captureEvents:(NSArray<NSDictionary *> *)events) {
    if (!self.sdkEnabled || events.count == 0) {
        return;
    }

    NSDictionary *envelope = [self buildEnvelopeWithEvents:events];
    [self.client enqueueEnvelope:envelope];
}

- (void)invalidate {
    self.client.statusHandler = nil;
    [self.client disconnectAndClearQueue];
}

#pragma mark - RCTEventEmitter

- (void)startObserving {
    self.hasListeners = YES;
}

- (void)stopObserving {
    self.hasListeners = NO;
}

#pragma mark - Helpers

- (NSDictionary *)buildEnvelopeWithEvents:(NSArray<NSDictionary *> *)events {
    return @{
        @"sdk": @{
            @"name": @"rnv_network_sdk_ios",
            @"version": RNVNetworkDevSDKVersion,
            @"schemaVersion": @1,
        },
        @"session": [self sessionMetadata],
        @"events": events,
    };
}

- (NSDictionary *)sessionMetadata {
    NSBundle *bundle = [NSBundle mainBundle];
    NSString *bundleIdentifier = bundle.bundleIdentifier ?: @"";
    NSString *displayName = [bundle objectForInfoDictionaryKey:@"CFBundleDisplayName"];
    if (displayName.length == 0) {
        displayName = [bundle objectForInfoDictionaryKey:@"CFBundleName"] ?: @"";
    }

    UIDevice *device = [UIDevice currentDevice];

    return @{
        @"id": self.sessionIdentifier,
        @"platform": @"ios",
        @"bundleIdentifier": bundleIdentifier,
        @"appName": displayName ?: @"",
        @"deviceName": device.name ?: @"",
        @"systemName": device.systemName ?: @"iOS",
        @"systemVersion": device.systemVersion ?: @"",
        @"isSimulator": @(RNVNetworkDevIsSimulator()),
    };
}

- (void)emitStatus:(NSString *)state detail:(nullable NSString *)detail {
    if (!self.hasListeners) {
        return;
    }

    dispatch_block_t emitBlock = ^{
        NSMutableDictionary *payload = [@{
            @"state": state ?: @"unknown",
            @"sessionId": self.sessionIdentifier ?: @"",
        } mutableCopy];

        if (detail.length > 0) {
            payload[@"detail"] = detail;
        }

        [self sendEventWithName:RNVNetworkDevStatusEventName body:payload];
    };

    if (NSThread.isMainThread) {
        emitBlock();
    } else {
        dispatch_async(dispatch_get_main_queue(), emitBlock);
    }
}

static BOOL RNVNetworkDevIsSimulator(void) {
#if TARGET_OS_SIMULATOR
    return YES;
#else
    return NO;
#endif
}

@end
