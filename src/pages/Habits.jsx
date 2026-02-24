import { useEffect, useMemo, useRef, useState } from "react";
import { FaBell } from "react-icons/fa6";
import HabitForm from "../components/HabitForm.jsx";
import HabitList from "../components/HabitList.jsx";
import SheetConfig from "../components/SheetConfig.jsx";
import {
  getNotificationPermissionState,
  initOneSignal,
  isOneSignalConfigured,
  requestOneSignalPermission,
} from "../lib/oneSignal.js";
import { useHabits } from "../state/HabitContext.jsx";

const todayISO = () => new Date().toISOString().slice(0, 10);
const REMINDER_CACHE_KEY = "habit_tracker_sent_reminder_keys";

const formatTimeLabel = (date) => {
  try {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
};

const canUseWebNotifications = () =>
  typeof window !== "undefined" && "Notification" in window && window.isSecureContext;

const showHabitNotification = async (body, tag) => {
  if (!canUseWebNotifications() || window.Notification.permission !== "granted") return;
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Habit reminder", {
        body,
        tag,
        renotify: true,
        icon: "/android-chrome-192x192.png",
        badge: "/android-chrome-192x192.png",
      });
      return;
    }
  } catch {
    // Fall back to page notification if service worker path fails.
  }

  try {
    new window.Notification("Habit reminder", { body, tag });
  } catch {
    // Ignore notification failures on restricted browsers.
  }
};

const readSentReminderKeys = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REMINDER_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const persistSentReminderKeys = (keysMap) => {
  if (typeof window === "undefined") return;
  const today = todayISO();
  const next = Object.fromEntries(
    Object.entries(keysMap).filter(([key, isSent]) => Boolean(isSent) && key.includes(`-${today}-`))
  );
  window.localStorage.setItem(REMINDER_CACHE_KEY, JSON.stringify(next));
};

export default function Habits() {
  const {
    hasSheet,
    isAuthenticated,
    isDemoMode,
    habits,
    getTimedDailyGoal,
    getTimedProgressCount,
    getScheduleMinutes,
    isTimedHabitScheduledOnDate,
  } = useHabits();
  const [permissionState, setPermissionState] = useState("unsupported");
  const [reminderText, setReminderText] = useState("");
  const lastReminderRef = useRef(readSentReminderKeys());
  const oneSignalEnabled = isOneSignalConfigured();

  useEffect(() => {
    let active = true;

    const initNotifications = async () => {
      if (!canUseWebNotifications()) {
        if (active) setPermissionState("unsupported");
        return;
      }

      if (oneSignalEnabled) {
        await initOneSignal();
      }
      const permission = await getNotificationPermissionState();
      if (active) setPermissionState(permission);
    };

    void initNotifications();
    return () => {
      active = false;
    };
  }, [oneSignalEnabled]);

  const activeTimedHabits = useMemo(() => {
    const today = todayISO();
    return habits.filter((habit) => habit.type === "timed" && isTimedHabitScheduledOnDate(habit, today));
  }, [habits, isTimedHabitScheduledOnDate]);

  useEffect(() => {
    if (permissionState === "unsupported") return undefined;

    const runReminderCheck = async () => {
      const now = new Date();
      const today = todayISO();
      let latestMessage = "";

      for (const habit of activeTimedHabits) {
        const goal = getTimedDailyGoal(habit, today);
        const progress = getTimedProgressCount(habit, today);
        if (progress >= goal) continue;

        const scheduleMinutes = getScheduleMinutes(habit);
        if (scheduleMinutes.length === 0) continue;

        const slotTimes = scheduleMinutes.map((minuteOfDay) => {
          const slot = new Date(`${today}T00:00:00`);
          slot.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
          return slot;
        });
        const dueSlots = slotTimes.filter((slot) => slot <= now);
        if (dueSlots.length === 0) continue;

        const expectedNow = Math.min(goal, dueSlots.length);
        if (progress >= expectedNow) continue;

        const reminderKey = `${habit.id}-${today}-${expectedNow}`;
        if (lastReminderRef.current[reminderKey]) continue;

        const dueTime = formatTimeLabel(dueSlots[dueSlots.length - 1]);
        const nextSlot = slotTimes.find((slot) => slot > now);
        const nextLabel = nextSlot ? formatTimeLabel(nextSlot) : "none";
        const behindBy = expectedNow - progress;
        const message = `${habit.name}: check-in due at ${dueTime}. Logged ${progress}/${goal}, behind by ${behindBy}. Next at ${nextLabel}.`;
        latestMessage = message;

        await showHabitNotification(message, reminderKey);
        lastReminderRef.current[reminderKey] = true;
        persistSentReminderKeys(lastReminderRef.current);
      }

      if (latestMessage) setReminderText(latestMessage);
    };

    void runReminderCheck();
    const intervalId = window.setInterval(() => {
      void runReminderCheck();
    }, 60000);
    return () => window.clearInterval(intervalId);
  }, [activeTimedHabits, getTimedDailyGoal, getTimedProgressCount, getScheduleMinutes, permissionState]);

  const requestNotifications = async () => {
    const permission = await requestOneSignalPermission();
    setPermissionState(permission);
  };

  return (
    <section className="grid gap-4">
      <SheetConfig />
      {(isDemoMode || isAuthenticated) && hasSheet ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <HabitForm />
          <div className="grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
                  <FaBell /> Reminders
                </h3>
                {permissionState === "default" && (
                  <button
                    type="button"
                    className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                    onClick={requestNotifications}
                  >
                    Enable notifications
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {permissionState === "granted"
                  ? oneSignalEnabled
                    ? "Push notifications are enabled with OneSignal."
                    : "Browser notifications are enabled for timed habits."
                  : permissionState === "denied"
                    ? "Browser notifications are blocked. You can allow them in browser settings."
                    : permissionState === "unsupported"
                      ? "Notifications need a secure context (HTTPS or localhost) and browser support."
                      : oneSignalEnabled
                        ? "Enable notifications to subscribe this device for OneSignal push alerts."
                        : "Enable notifications to get timely reminders."}
              </p>
              {reminderText && (
                <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{reminderText}</div>
              )}
            </div>
            <HabitList />
          </div>
        </div>
      ) : isAuthenticated && !isDemoMode ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
          Enter your Google Sheet ID to load and manage your habits.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
          Sign in with Google or try demo mode to start using HabitTracker.
        </div>
      )}
    </section>
  );
}
