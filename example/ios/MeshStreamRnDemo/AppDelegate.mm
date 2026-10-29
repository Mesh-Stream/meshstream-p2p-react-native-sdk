#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"MeshStreamRnDemo";
  self.automaticallyLoadReactNativeWindow = NO;
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end

@interface MeshStreamSceneDelegate : UIResponder <UIWindowSceneDelegate>
@property(nonatomic, strong) UIWindow *window;
@end

@implementation MeshStreamSceneDelegate

- (void)scene:(UIScene *)scene
    willConnectToSession:(UISceneSession *)session
    options:(UISceneConnectionOptions *)connectionOptions
{
  AppDelegate *app = (AppDelegate *)UIApplication.sharedApplication.delegate;
  UIView *rootView = [app.rootViewFactory viewWithModuleName:app.moduleName
                                       initialProperties:app.initialProps
                                           launchOptions:@{}];
  UIViewController *controller = [app createRootViewController];
  [app setRootView:rootView toRootViewController:controller];
  self.window = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];
  self.window.rootViewController = controller;
  app.window = self.window;
  [self.window makeKeyAndVisible];
}

@end
