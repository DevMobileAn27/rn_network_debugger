#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^RNVNetworkDevStatusHandler)(NSString *state, NSString * _Nullable detail);

@interface RNVNetworkDevWebSocketClient : NSObject

@property (nonatomic, copy, nullable) RNVNetworkDevStatusHandler statusHandler;

- (void)configureWithURLString:(nullable NSString *)URLString
                  maxQueueSize:(NSInteger)maxQueueSize
             connectionHeaders:(NSDictionary<NSString *, NSString *> *)connectionHeaders;

- (void)enqueueEnvelope:(NSDictionary *)envelope;
- (void)disconnect;
- (void)disconnectAndClearQueue;

@end

NS_ASSUME_NONNULL_END
