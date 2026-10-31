#import <XCTest/XCTest.h>
#import <MeshStreamKit/MeshStreamKit.h>

#import "../../ios/MeshStreamP2PValidation.h"

@interface MeshStreamP2PValidationTests : XCTestCase
@end

@implementation MeshStreamP2PValidationTests

- (void)testNativeVersionIsAvailableBeforeCreatingClient {
    XCTAssertEqualObjects([P2PSDK getSdkVersion], @"1.0.7");
}

- (void)testTrimsURLsAndFiltersNonStringHeaders {
    XCTAssertEqualObjects(
        MeshStreamTrimmedString(@"  content-42\n"),
        @"content-42");
    XCTAssertNil(MeshStreamTrimmedString(@42));
    XCTAssertEqualObjects(
        MeshStreamHTTPURLFromValue(@" https://example.com/live.m3u8 ").absoluteString,
        @"https://example.com/live.m3u8");
    XCTAssertNil(MeshStreamHTTPURLFromValue(@"ftp://example.com/live.m3u8"));
    NSDictionary *headers = MeshStreamStringHeaders(@{
        @"Authorization": @"Bearer token",
        @"retry": @1,
        @2: @"ignored",
    });
    NSDictionary *expectedHeaders = @{
        @"Authorization": @"Bearer token",
    };
    XCTAssertEqualObjects(headers, expectedHeaders);
}

@end
