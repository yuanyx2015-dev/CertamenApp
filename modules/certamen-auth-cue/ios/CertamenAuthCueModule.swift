import ExpoModulesCore
import UIKit

/// The system sign-in sheet does not report its button taps. Continue is the
/// moment the in-app browser becomes the top screen.
public class CertamenAuthCueModule: Module {
  private var observers: [NSObjectProtocol] = []
  private var watch: Timer?
  private var inactiveSince: Date?
  private var sawUnderlyingScreen = false
  private var wasBrowser = false
  private var played = false

  public func definition() -> ModuleDefinition {
    Name("CertamenAuthCue")

    Events("onContinue")

    OnStartObserving {
      self.observers.append(
        NotificationCenter.default.addObserver(
          forName: UIApplication.willResignActiveNotification,
          object: nil,
          queue: .main
        ) { [weak self] _ in
          self?.arm()
        }
      )
      self.observers.append(
        NotificationCenter.default.addObserver(
          forName: UIApplication.didBecomeActiveNotification,
          object: nil,
          queue: .main
        ) { [weak self] _ in
          self?.scheduleDisarm()
        }
      )
      self.arm()
    }

    OnStopObserving {
      for observer in self.observers {
        NotificationCenter.default.removeObserver(observer)
      }
      self.observers.removeAll()
      self.disarm()
    }
  }

  private func arm() {
    let alreadyWatching = watch != nil
    inactiveSince = Date()
    if !alreadyWatching {
      sawUnderlyingScreen = false
      wasBrowser = false
      played = false
    }
    watch?.invalidate()
    let timer = Timer(timeInterval: 0.05, repeats: true) { [weak self] _ in
      self?.look()
    }
    watch = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  private func scheduleDisarm() {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
      guard UIApplication.shared.applicationState == .active else { return }
      self?.disarm()
    }
  }

  private func disarm() {
    watch?.invalidate()
    watch = nil
    inactiveSince = nil
    sawUnderlyingScreen = false
    wasBrowser = false
    played = false
  }

  private func look() {
    guard !played else { return }
    var sawBrowser = false
    var sawOther = false
    for window in allWindows() {
      guard let top = topViewController(in: window) else { continue }
      if isAuthBrowser(top) {
        sawBrowser = true
      } else {
        sawOther = true
      }
    }
    if sawOther {
      sawUnderlyingScreen = true
    }
    let ready = inactiveSince.map { Date().timeIntervalSince($0) > 0.15 } ?? false
    if ready && sawUnderlyingScreen && sawBrowser && !wasBrowser {
      played = true
      wasBrowser = true
      sendEvent("onContinue")
      return
    }
    wasBrowser = sawBrowser
  }

  private func allWindows() -> [UIWindow] {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
  }

  private func topViewController(in window: UIWindow) -> UIViewController? {
    var current = window.rootViewController
    while let presented = current?.presentedViewController {
      current = presented
    }
    return current
  }

  private func isAuthBrowser(_ viewController: UIViewController) -> Bool {
    var current: UIViewController? = viewController
    var depth = 0
    while let viewController = current, depth < 5 {
      let name = NSStringFromClass(type(of: viewController))
      if name.contains("SFAuthentication") || name.contains("ASWebAuthentication") {
        return true
      }
      if let navigation = viewController as? UINavigationController {
        current = navigation.viewControllers.first
      } else {
        current = viewController.children.first
      }
      depth += 1
    }
    return false
  }
}
