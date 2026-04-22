#import "RNVNetworkDevWebSocketClient.h"

#import <UIKit/UIKit.h>

@interface RNVNetworkDevWebSocketClient () <NSURLSessionWebSocketDelegate>

@property (nonatomic, strong, nullable) NSURLSession *session;
@property (nonatomic, strong, nullable) NSURLSessionWebSocketTask *webSocketTask;
@property (nonatomic, copy, nullable) NSString *URLString;
@property (nonatomic, assign) NSInteger maxQueueSize;
@property (nonatomic, assign) BOOL socketOpen;
@property (nonatomic, strong) NSMutableArray<NSString *> *pendingMessages;
@property (nonatomic, copy) NSDictionary<NSString *, NSString *> *connectionHeaders;
@property (nonatomic, strong) dispatch_queue_t stateQueue;

@end

@implementation RNVNetworkDevWebSocketClient

static NSString * const RNVNetworkDevExpectedPath = @"/rnv/network";
static NSInteger const RNVNetworkDevExpectedPort = 38940;

- (instancetype)init {
    self = [super init];
    if (self) {
        _maxQueueSize = 200;
        _pendingMessages = [NSMutableArray new];
        _connectionHeaders = @{};
        _stateQueue = dispatch_queue_create("com.reactnativeviewer.rnv-network-sdk-ios-client", DISPATCH_QUEUE_SERIAL);

        NSNotificationCenter *notificationCenter = [NSNotificationCenter defaultCenter];
        [notificationCenter addObserver:self
                               selector:@selector(handleApplicationDidEnterBackground:)
                                   name:UIApplicationDidEnterBackgroundNotification
                                 object:nil];
        [notificationCenter addObserver:self
                               selector:@selector(handleApplicationDidBecomeActive:)
                                   name:UIApplicationDidBecomeActiveNotification
                                 object:nil];
    }

    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [self disconnectLocked];
}

- (void)configureWithURLString:(nullable NSString *)URLString
                  maxQueueSize:(NSInteger)maxQueueSize
             connectionHeaders:(NSDictionary<NSString *,NSString *> *)connectionHeaders {
    dispatch_async(self.stateQueue, ^{
        BOOL URLChanged = ![self.URLString isEqualToString:URLString ?: @""];

        self.URLString = URLString;
        self.maxQueueSize = MAX(maxQueueSize, 50);
        self.connectionHeaders = connectionHeaders ?: @{};

        if (URLChanged) {
            [self disconnectLocked];
        }

        if (self.URLString.length == 0) {
            [self emitStatus:@"disabled" detail:@"Missing viewer URL."];
            return;
        }

        NSString *configurationError = [self configurationErrorForURLString:self.URLString];
        if (configurationError != nil) {
            [self emitStatus:@"configuration_error" detail:configurationError];
            return;
        }

        [self emitStatus:@"configured" detail:nil];
    });
}

- (void)enqueueEnvelope:(NSDictionary *)envelope {
    NSError *serializationError = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:envelope options:0 error:&serializationError];
    if (serializationError != nil || data == nil) {
        [self emitStatus:@"serialization_error" detail:serializationError.localizedDescription];
        return;
    }

    NSString *message = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    if (message.length == 0) {
        [self emitStatus:@"serialization_error" detail:@"Unable to encode envelope as UTF-8 string."];
        return;
    }

    dispatch_async(self.stateQueue, ^{
        if (self.pendingMessages.count >= self.maxQueueSize) {
            [self.pendingMessages removeObjectAtIndex:0];
        }

        [self.pendingMessages addObject:message];
        [self connectIfNeededLocked];

        if (self.socketOpen) {
            [self flushPendingMessagesLocked];
        }
    });
}

- (void)disconnect {
    dispatch_async(self.stateQueue, ^{
        [self disconnectLocked];
    });
}

- (void)disconnectAndClearQueue {
    dispatch_async(self.stateQueue, ^{
        [self.pendingMessages removeAllObjects];
        [self disconnectLocked];
    });
}

- (void)connectIfNeededLocked {
    if (self.socketOpen || self.webSocketTask != nil || self.URLString.length == 0) {
        return;
    }

    NSURL *URL = [NSURL URLWithString:self.URLString];
    if (URL == nil) {
        [self emitStatus:@"configuration_error" detail:@"Viewer URL is invalid."];
        return;
    }

    NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration ephemeralSessionConfiguration];
    self.session = [NSURLSession sessionWithConfiguration:configuration delegate:self delegateQueue:nil];

    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:URL];
    [self.connectionHeaders enumerateKeysAndObjectsUsingBlock:^(NSString *key, NSString *value, BOOL *stop) {
        [request setValue:value forHTTPHeaderField:key];
    }];

    self.webSocketTask = [self.session webSocketTaskWithRequest:request];
    [self.webSocketTask resume];
    [self startReceiveLoopLocked];
    [self emitStatus:@"connecting" detail:nil];
}

- (void)flushPendingMessagesLocked {
    if (!self.socketOpen || self.webSocketTask == nil || self.pendingMessages.count == 0) {
        return;
    }

    NSArray<NSString *> *messages = [self.pendingMessages copy];
    [self.pendingMessages removeAllObjects];

    for (NSString *message in messages) {
        [self.webSocketTask sendMessage:[[NSURLSessionWebSocketMessage alloc] initWithString:message]
                      completionHandler:^(NSError * _Nullable error) {
            if (error != nil) {
                [self emitStatus:@"send_error" detail:error.localizedDescription];
            }
        }];
    }
}

- (void)startReceiveLoopLocked {
    NSURLSessionWebSocketTask *activeTask = self.webSocketTask;
    if (activeTask == nil) {
        return;
    }

    __weak typeof(self) weakSelf = self;
    [activeTask receiveMessageWithCompletionHandler:^(NSURLSessionWebSocketMessage * _Nullable message, NSError * _Nullable error) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }

        dispatch_async(strongSelf.stateQueue, ^{
            if (activeTask != strongSelf.webSocketTask) {
                return;
            }

            if (error != nil) {
                [strongSelf emitStatus:@"receive_error" detail:error.localizedDescription];
                strongSelf.socketOpen = NO;
                strongSelf.webSocketTask = nil;
                strongSelf.session = nil;
                return;
            }

            [strongSelf startReceiveLoopLocked];
        });
    }];
}

- (void)emitStatus:(NSString *)state detail:(nullable NSString *)detail {
    RNVNetworkDevStatusHandler handler = self.statusHandler;
    if (handler != nil) {
        dispatch_async(dispatch_get_main_queue(), ^{
            handler(state, detail);
        });
    }
}

- (void)disconnectLocked {
    self.socketOpen = NO;
    [self.webSocketTask cancelWithCloseCode:NSURLSessionWebSocketCloseCodeGoingAway reason:nil];
    [self.session invalidateAndCancel];
    self.webSocketTask = nil;
    self.session = nil;
}

- (nullable NSString *)configurationErrorForURLString:(NSString *)URLString {
    NSURL *URL = [NSURL URLWithString:URLString];
    if (URL == nil) {
        return @"Viewer URL is invalid.";
    }

    NSString *scheme = URL.scheme.lowercaseString ?: @"";
    if (![scheme isEqualToString:@"ws"] && ![scheme isEqualToString:@"wss"]) {
        return @"Viewer URL must use ws:// or wss://.";
    }

    NSNumber *port = URL.port;
    if (port == nil || port.integerValue != RNVNetworkDevExpectedPort) {
        return @"Viewer URL must use the React Native Viewer ingest port 38940, not a React Native/Metro dev server port like 8081.";
    }

    NSString *path = [self normalizedPathForURL:URL];
    if ([path containsString:@"/inspector"] ||
        [path containsString:@"/json"] ||
        [path containsString:@"/devtools"]) {
        return @"Viewer URL looks like a React Native inspector/devtools endpoint. Use the React Native Viewer ingest endpoint instead.";
    }

    if (![path isEqualToString:RNVNetworkDevExpectedPath]) {
        return @"Viewer URL must point to the React Native Viewer ingest path /rnv/network.";
    }

    return nil;
}

- (NSString *)normalizedPathForURL:(NSURL *)URL {
    NSString *path = URL.path ?: @"";
    while (path.length > 1 && [path hasSuffix:@"/"]) {
        path = [path substringToIndex:path.length - 1];
    }

    return path;
}

- (void)handleApplicationDidEnterBackground:(NSNotification *)notification {
    dispatch_async(self.stateQueue, ^{
        [self disconnectLocked];
    });
}

- (void)handleApplicationDidBecomeActive:(NSNotification *)notification {
    dispatch_async(self.stateQueue, ^{
        if (self.pendingMessages.count > 0) {
            [self connectIfNeededLocked];
        }
    });
}

#pragma mark - NSURLSessionWebSocketDelegate

- (void)URLSession:(NSURLSession *)session
      webSocketTask:(NSURLSessionWebSocketTask *)webSocketTask
didOpenWithProtocol:(NSString * _Nullable)protocol {
    dispatch_async(self.stateQueue, ^{
        if (webSocketTask != self.webSocketTask) {
            return;
        }

        self.socketOpen = YES;
        [self emitStatus:@"connected" detail:nil];
        [self flushPendingMessagesLocked];
    });
}

- (void)URLSession:(NSURLSession *)session
      webSocketTask:(NSURLSessionWebSocketTask *)webSocketTask
didCloseWithCode:(NSURLSessionWebSocketCloseCode)closeCode
            reason:(NSData * _Nullable)reason {
    dispatch_async(self.stateQueue, ^{
        if (webSocketTask != self.webSocketTask) {
            return;
        }

        self.socketOpen = NO;
        self.webSocketTask = nil;
        self.session = nil;

        NSString *detail = nil;
        if (reason.length > 0) {
            detail = [[NSString alloc] initWithData:reason encoding:NSUTF8StringEncoding];
        }

        [self emitStatus:@"disconnected" detail:detail ?: [NSString stringWithFormat:@"Close code: %ld", (long)closeCode]];
    });
}

@end
