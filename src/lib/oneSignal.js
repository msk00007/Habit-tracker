const ONE_SIGNAL_SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
const ONE_SIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

let sdkLoadPromise = null;
let initPromise = null;

export const isOneSignalConfigured = () => Boolean(ONE_SIGNAL_APP_ID);

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
        resolve(permission ?? window.Notification.permission);
      } catch {
        resolve(window.Notification.permission);
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
        resolve(OneSignal.Notifications.permission ?? window.Notification.permission);
      } catch {
        try {
          const permission = await window.Notification.requestPermission();
          resolve(permission);
        } catch {
          resolve("denied");
        }
      }
    });
  });
};
