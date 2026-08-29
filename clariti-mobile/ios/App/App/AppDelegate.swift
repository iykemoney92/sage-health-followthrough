import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, MessagingDelegate {

    // Deep links (the OAuth custom-scheme return and useclariti.app Universal
    // Links) do NOT arrive here: this is a scene-based app, so iOS delivers them
    // to SceneDelegate, which already forwards them to Capacitor. Push
    // registration is the exception — those callbacks stay on the app delegate
    // even under UIScene, which is the only reason this file exists.

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Guarded rather than called unconditionally: FirebaseApp.configure()
        // traps at launch when GoogleService-Info.plist is absent, which would
        // make the shell unrunnable for anyone who has not yet added the Firebase
        // project. Push is the only thing that needs Firebase, so its absence
        // should cost push and nothing else.
        if Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist") != nil {
            FirebaseApp.configure()
            Messaging.messaging().delegate = self
        }
        return true
    }

    // Capacitor's push-notifications plugin registers for remote notifications and
    // hands this raw APNs token to FirebaseMessaging, which exchanges it for an FCM
    // token — that's what the backend actually sends to, since Firebase proxies
    // both platforms' pushes through one Admin SDK call rather than the backend
    // talking to APNs directly.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        guard FirebaseApp.app() != nil else { return }
        Messaging.messaging().apnsToken = deviceToken
    }

    // Without this the failure is swallowed: the plugin listens for this
    // notification to emit `registrationError`, so the JS promise would hang until
    // its own timeout rather than reporting why. iOS fails here whenever the
    // aps-environment entitlement is missing — every simulator run, and any build
    // made before the Push Notifications capability is enabled.
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error
        )
    }

    // Fires whenever Firebase (re)issues an FCM token — including the first exchange
    // after apnsToken is set above. Forward it into Capacitor's JS bridge as if it
    // were a normal push-notifications "registration" event, so the web app needs no
    // native-vs-web branching beyond isNativePlatform().
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken else { return }
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: fcmToken
        )
    }
}
