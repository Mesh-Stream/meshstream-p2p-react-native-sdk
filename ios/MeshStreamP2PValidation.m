#import "MeshStreamP2PValidation.h"

NSString *MeshStreamTrimmedString(id value) {
    if (![value isKindOfClass:NSString.class]) return nil;
    return [(NSString *)value stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
}

NSURL *MeshStreamHTTPURLFromValue(id value) {
    NSString *text = MeshStreamTrimmedString(value);
    NSURL *url = text.length > 0 ? [NSURL URLWithString:text] : nil;
    NSString *scheme = url.scheme.lowercaseString;
    if (!([scheme isEqualToString:@"http"] || [scheme isEqualToString:@"https"]) || url.host.length == 0) return nil;
    return url;
}

NSDictionary<NSString *, NSString *> *MeshStreamStringHeaders(id value) {
    if (![value isKindOfClass:NSDictionary.class]) return @{};
    NSMutableDictionary<NSString *, NSString *> *headers = [NSMutableDictionary dictionary];
    [(NSDictionary *)value enumerateKeysAndObjectsUsingBlock:^(id key, id item, BOOL *stop) {
        if ([key isKindOfClass:NSString.class] && [item isKindOfClass:NSString.class]) headers[key] = item;
    }];
    return headers;
}
