const ONE_SIGNAL_SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
const ONE_SIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

let sdkLoadPromise = null;
let initPromise = null;

export const isOneSignalConfigured = () => Boolean(ONE_SIGNAL_APP_ID);

const normalizePermissionState = (value) => {
  if (value === "granted" || value === "denied" || value === "default") return value;
  if (value === true) return "granted";
  if (value === false) {
    if (typeof window !== "undefined" && "Notification" in window) {
      return window.Notification.permission;
    }
    return "default";
  }
  if (typeof window !== "undefined" && "Notification" in window) {
    return window.Notification.permission;
  }
  return "unsupported";
};

const canUseBrowserNotifications = () =>
  typeof window !== "undefined" && "Notification" in window && window.isSecureContext;

const ensureDeferredQueue = () => {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  return window.OneSignalDeferred;
};

const loadSdkScript = () => {
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("OneSignal requires browser context."));
      return;
    }

    const existing = document.querySelector(`script[src="${ONE_SIGNAL_SDK_URL}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = ONE_SIGNAL_SDK_URL;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load OneSignal SDK."));
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
};

export const initOneSignal = async () => {
  if (!isOneSignalConfigured() || !canUseBrowserNotifications()) return false;
  if (initPromise) return initPromise;

  initPromise = loadSdkScript()
    .then(
      () =>
        new Promise((resolve) => {
          ensureDeferredQueue().push(async (OneSignal) => {
            try {
              await OneSignal.init({
                appId: ONE_SIGNAL_APP_ID,
                allowLocalhostAsSecureOrigin: true,
                serviceWorkerPath: "/onesignal/OneSignalSDKWorker.js",
                serviceWorkerUpdaterPath: "/onesignal/OneSignalSDKUpdaterWorker.js",
                serviceWorkerParam: { scope: "/onesignal/" },
                notifyButton: { enable: false },
              });
              resolve(true);
            } catch {
              resolve(false);
            }
          });
        })
    )
    .catch(() => false);

  return initPromise;
};

export const getNotificationPermissionState = async () => {
  if (!canUseBrowserNotifications()) return "unsupported";
  if (!isOneSignalConfigured()) return window.Notification.permission;
  await initOneSignal();

  return new Promise((resolve) => {
    ensureDeferredQueue().push(async (OneSignal) => {
      try {
        const permission = OneSignal?.Notifications?.permission;
        resolve(normalizePermissionState(permission));
      } catch {
        resolve(normalizePermissionState(window.Notification.permission));
      }
    });
  });
};

export const requestOneSignalPermission = async () => {
  if (!canUseBrowserNotifications()) return "unsupported";
  if (!isOneSignalConfigured()) return window.Notification.requestPermission();
  await initOneSignal();

  return new Promise((resolve) => {
    ensureDeferredQueue().push(async (OneSignal) => {
      try {
        await OneSignal.Notifications.requestPermission();
        await OneSignal.User.PushSubscription.optIn();
        resolve(normalizePermissionState(OneSignal.Notifications.permission));
      } catch {
        try {
          const permission = await window.Notification.requestPermission();
          if (permission === "granted") {
            try {
              await OneSignal.User.PushSubscription.optIn();
            } catch {
              // Ignore OneSignal opt-in failures and return browser state.
            }
          }
          resolve(normalizePermissionState(permission));
        } catch {
          resolve("denied");
        }
      }
    });
  });
};
