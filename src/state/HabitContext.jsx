import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const HabitContext = createContext(null);

const todayISO = () => new Date().toISOString().slice(0, 10);
const SHEET_ID_KEY = "habit_tracker_sheet_id";
const DEMO_MODE_KEY = "habit_tracker_demo_mode";
const DEMO_HABITS_KEY = "habit_tracker_demo_habits";
const HABIT_SHEET_NAME = "habits";
const HABIT_HEADERS = [
  "id",
  "name",
  "description",
  "frequency",
  "color",
  "completions_json",
  "type",
  "interval_minutes",
  "start_time",
  "end_time",
  "skip_weekdays_json",
  "skipped_dates_json",
  "timed_logs_json",
  "target_date_legacy",
  "interval_hours_legacy",
  "timed_progress_json_legacy",
];
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

const parseTimeToMinutes = (timeValue) => {
  if (typeof timeValue !== "string" || !timeValue.includes(":")) return null;
  const [rawHours, rawMinutes] = timeValue.split(":");
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
};

const getScheduleMinutes = (habit) => {
  const interval = Number(habit?.intervalMinutes ?? 30);
  if (!Number.isFinite(interval) || interval < 1) return [];

  const startMinutes = parseTimeToMinutes(habit?.startTime ?? "09:00");
  const endMinutes = parseTimeToMinutes(habit?.endTime ?? "21:00");
  if (startMinutes === null || endMinutes === null) return [];
  if (endMinutes <= startMinutes) return [];

  const slots = [];
  for (let minute = startMinutes; minute <= endMinutes; minute += interval) {
    slots.push(minute);
  }
  return slots;
};

const getNormalizedTimedLogsForDate = (habit, date) => {
  const schedule = getScheduleMinutes(habit);
  const maxSlotIndex = Math.max(0, schedule.length - 1);
  const rawLogs = Array.isArray(habit?.timedLogs?.[date]) ? habit.timedLogs[date] : [];

  const normalizedSlotIndices = rawLogs
    .map((entry, index) => {
      if (entry && typeof entry === "object" && Number.isInteger(entry.slotIndex)) {
        return entry.slotIndex;
      }
      if (typeof entry === "string") {
        return index;
      }
      return null;
    })
    .filter((slotIndex) => Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex <= maxSlotIndex);

  return [...new Set(normalizedSlotIndices)].sort((a, b) => a - b);
};

const getTimedLogState = (habit, date = todayISO()) => {
  const scheduled = isTimedHabitScheduledOnDate(habit, date);
  const schedule = getScheduleMinutes(habit);
  const completedSlotIndices = getNormalizedTimedLogsForDate(habit, date);
  const completedSet = new Set(completedSlotIndices);

  if (!scheduled || schedule.length === 0) {
    return {
      canLogNow: false,
      reason: "not_scheduled",
      activeSlotIndex: -1,
      completedSlotIndices,
      schedule,
    };
  }

  if (date !== todayISO()) {
    return {
      canLogNow: false,
      reason: "date_locked",
      activeSlotIndex: -1,
      completedSlotIndices,
      schedule,
    };
  }

  const interval = Number(habit?.intervalMinutes ?? 30);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const activeSlotIndex = schedule.findIndex(
    (slotStart) => nowMinutes >= slotStart && nowMinutes < slotStart + interval
  );

  if (activeSlotIndex === -1) {
    return {
      canLogNow: false,
      reason: nowMinutes < schedule[0] ? "before_start" : "outside_slot",
      activeSlotIndex: -1,
      completedSlotIndices,
      schedule,
    };
  }

  if (completedSet.has(activeSlotIndex)) {
    return {
      canLogNow: false,
      reason: "already_logged",
      activeSlotIndex,
      completedSlotIndices,
      schedule,
    };
  }

  return {
    canLogNow: true,
    reason: "ok",
    activeSlotIndex,
    completedSlotIndices,
    schedule,
  };
};

const normalizeHabit = (habit) => {
  const parsedIntervalMinutes = Number(habit.intervalMinutes ?? Number(habit.intervalHours ?? 1) * 60);
  const intervalMinutes =
    Number.isFinite(parsedIntervalMinutes) && parsedIntervalMinutes > 0
      ? parsedIntervalMinutes
      : 30;
  const parsedSkipWeekdays = Array.isArray(habit.skipWeekdays)
    ? habit.skipWeekdays.map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : [];

  return {
    id: habit.id ?? `h${Date.now()}`,
    name: habit.name ?? "",
    description: habit.description ?? "",
    frequency: habit.frequency ?? "Daily",
    color: habit.color ?? "#59a7ff",
    completions: habit.completions ?? {},
    type: habit.type ?? "standard",
    targetDate: habit.targetDate ?? "",
    intervalMinutes,
    startTime: habit.startTime ?? "09:00",
    endTime: habit.endTime ?? "21:00",
    skipWeekdays: [...new Set(parsedSkipWeekdays)],
    skippedDates: habit.skippedDates ?? {},
    timedLogs: habit.timedLogs ?? {},
    timedProgress: habit.timedProgress ?? {},
  };
};

const isTimedHabitScheduledOnDate = (habit, date) => {
  if (habit?.type !== "timed") return false;
  if (habit.targetDate && habit.targetDate !== date) return false;
  if (habit.skippedDates?.[date]) return false;

  const parsedDate = new Date(`${date}T00:00:00`);
  const dayOfWeek = parsedDate.getDay();
  if (habit.skipWeekdays?.includes(dayOfWeek)) return false;
  return true;
};

const getTimedDailyGoal = (habit, date = todayISO()) => {
  if (!isTimedHabitScheduledOnDate(habit, date)) return 0;
  return getScheduleMinutes(habit).length;
};

const getTimedProgressCount = (habit, date = todayISO()) => {
  const logsForDate = getNormalizedTimedLogsForDate(habit, date);
  const legacyProgress = Number(habit.timedProgress?.[date] ?? 0);
  return Math.max(logsForDate.length, Number.isFinite(legacyProgress) ? legacyProgress : 0);
};

const getTimedCompletedSlotIndices = (habit, date = todayISO()) => getNormalizedTimedLogsForDate(habit, date);

const isHabitDoneOnDate = (habit, date) => {
  if (habit.type === "timed") {
    if (!isTimedHabitScheduledOnDate(habit, date)) {
      return Boolean(habit.skippedDates?.[date]);
    }
    const goal = getTimedDailyGoal(habit, date);
    if (goal === 0) return false;
    return getTimedProgressCount(habit, date) >= goal;
  }
  return Boolean(habit.completions?.[date]);
};

const readStoredSheetId = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SHEET_ID_KEY) ?? "";
};

const readStoredDemoMode = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DEMO_MODE_KEY) === "true";
};

const seedDemoHabits = [
  {
    id: "demo-1",
    name: "Morning walk",
    description: "20-minute brisk walk",
    frequency: "Daily",
    color: "#59a7ff",
    completions: {
      [todayISO()]: true,
    },
  },
  {
    id: "demo-2",
    name: "Read 20 minutes",
    description: "Book or article reading",
    frequency: "Daily",
    color: "#6dd3a9",
    completions: {},
  },
];

const readDemoHabits = () => {
  if (typeof window === "undefined") return seedDemoHabits;
  const raw = window.localStorage.getItem(DEMO_HABITS_KEY);
  if (!raw) return seedDemoHabits;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedDemoHabits;
    return parsed.map(normalizeHabit);
  } catch {
    return seedDemoHabits;
  }
};

const saveDemoHabits = (habits) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_HABITS_KEY, JSON.stringify(habits));
};

const loadGoogleIdentityScript = () =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google Identity script is unavailable on server."));
      return;
    }

    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Identity script.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity script."));
    document.head.appendChild(script);
  });

const parseCompletionJson = (value) => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const parseArrayJson = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function HabitProvider({ children }) {
  const [habits, setHabits] = useState([]);
  const [editingHabit, setEditingHabit] = useState(null);
  const [sheetId, setSheetId] = useState(readStoredSheetId);
  const [isDemoMode, setIsDemoMode] = useState(readStoredDemoMode);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [tokenClientReady, setTokenClientReady] = useState(false);

  const oauthConfigured = Boolean(GOOGLE_CLIENT_ID);
  const hasSheet = isDemoMode || Boolean(sheetId);

  const getFreshAccessToken = useCallback(
    (prompt = "") =>
      new Promise((resolve, reject) => {
        if (!oauthConfigured) {
          reject(new Error("Missing VITE_GOOGLE_CLIENT_ID in environment."));
          return;
        }
        if (!window.google?.accounts?.oauth2) {
          reject(new Error("Google Identity client not initialized."));
          return;
        }

        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: GOOGLE_SCOPE,
          callback: (response) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error));
              return;
            }
            setAccessToken(response.access_token);
            setIsAuthenticated(true);
            setAuthError("");
            resolve(response.access_token);
          },
        });

        client.requestAccessToken({ prompt });
      }),
    [oauthConfigured]
  );

  const apiRequest = useCallback(
    async (path, options = {}) => {
      if (!accessToken) {
        setIsAuthenticated(false);
        setAccessToken("");
        throw new Error("Please sign in with Google first.");
      }

      const response = await fetch(`${SHEETS_API_BASE}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...(options.headers ?? {}),
        },
      });

      if (response.status === 401) {
        setIsAuthenticated(false);
        setAccessToken("");
        throw new Error("Session expired. Please sign in again.");
      }

      const bodyText = await response.text();
      const data = bodyText ? JSON.parse(bodyText) : {};

      if (!response.ok) {
        const message = data?.error?.message ?? "Google Sheets API request failed.";
        throw new Error(message);
      }

      return data;
    },
    [accessToken]
  );

  const ensureHabitSheet = useCallback(
    async (targetSheetId) => {
      const meta = await apiRequest(`/${targetSheetId}?fields=sheets.properties`);
      const sheetNames = (meta.sheets ?? []).map((sheet) => sheet.properties?.title);

      if (!sheetNames.includes(HABIT_SHEET_NAME)) {
        await apiRequest(`/${targetSheetId}:batchUpdate`, {
          method: "POST",
          body: JSON.stringify({
            requests: [{ addSheet: { properties: { title: HABIT_SHEET_NAME } } }],
          }),
        });
      }

      await apiRequest(
        `/${targetSheetId}/values/${HABIT_SHEET_NAME}!A1:P1?valueInputOption=RAW`,
        {
          method: "PUT",
          body: JSON.stringify({ values: [HABIT_HEADERS] }),
        }
      );
    },
    [apiRequest]
  );

  const readHabitsFromSheet = useCallback(
    async (targetSheetId) => {
      await ensureHabitSheet(targetSheetId);
      const data = await apiRequest(`/${targetSheetId}/values/${HABIT_SHEET_NAME}!A2:P`);
      const values = data.values ?? [];

      return values.map((row) =>
        normalizeHabit({
          id: row[0],
          name: row[1],
          description: row[2],
          frequency: row[3],
          color: row[4],
          completions: parseCompletionJson(row[5]),
          type: row[6] || "standard",
          intervalMinutes: row[7] ? Number(row[7]) : undefined,
          startTime: row[8] || "09:00",
          endTime: row[9] || "21:00",
          skipWeekdays: parseArrayJson(row[10]),
          skippedDates: parseCompletionJson(row[11]),
          timedLogs: parseCompletionJson(row[12]),
          targetDate: row[13] || "",
          intervalHours: row[14] ? Number(row[14]) : undefined,
          timedProgress: parseCompletionJson(row[15]),
        })
      );
    },
    [apiRequest, ensureHabitSheet]
  );

  const writeHabitsToSheet = useCallback(
    async (targetSheetId, nextHabits) => {
      await ensureHabitSheet(targetSheetId);

      await apiRequest(`/${targetSheetId}/values:batchClear`, {
        method: "POST",
        body: JSON.stringify({
          ranges: [`${HABIT_SHEET_NAME}!A2:P`],
        }),
      });

      if (nextHabits.length === 0) return;

      const rows = nextHabits.map((habit) => [
        habit.id,
        habit.name,
        habit.description,
        habit.frequency,
        habit.color,
        JSON.stringify(habit.completions ?? {}),
        habit.type ?? "standard",
        habit.intervalMinutes ?? 30,
        habit.startTime ?? "09:00",
        habit.endTime ?? "21:00",
        JSON.stringify(habit.skipWeekdays ?? []),
        JSON.stringify(habit.skippedDates ?? {}),
        JSON.stringify(habit.timedLogs ?? {}),
        habit.targetDate ?? "",
        (habit.intervalMinutes ?? 30) / 60,
        JSON.stringify(habit.timedProgress ?? {}),
      ]);

      await apiRequest(
        `/${targetSheetId}/values/${HABIT_SHEET_NAME}!A2:P?valueInputOption=RAW`,
        {
          method: "PUT",
          body: JSON.stringify({ values: rows }),
        }
      );
    },
    [apiRequest, ensureHabitSheet]
  );

  const loadHabits = useCallback(
    async (targetSheetId = sheetId) => {
      if (isDemoMode) {
        setHabits(readDemoHabits());
        return;
      }

      if (!targetSheetId || !isAuthenticated) {
        setHabits([]);
        return;
      }

      setIsSyncing(true);
      setSyncError("");
      try {
        const loadedHabits = await readHabitsFromSheet(targetSheetId);
        setHabits(loadedHabits);
      } catch (error) {
        setSyncError(error.message);
      } finally {
        setIsSyncing(false);
      }
    },
    [isAuthenticated, isDemoMode, readHabitsFromSheet, sheetId]
  );

  const writeHabits = useCallback(
    async (nextHabits, targetSheetId = sheetId) => {
      if (isDemoMode) {
        saveDemoHabits(nextHabits);
        setHabits(nextHabits);
        return;
      }

      if (!targetSheetId) {
        setSyncError("Enter a Google Sheet ID before saving habits.");
        return;
      }
      if (!isAuthenticated) {
        setSyncError("Sign in with Google before saving habits.");
        return;
      }

      setIsSyncing(true);
      setSyncError("");
      try {
        await writeHabitsToSheet(targetSheetId, nextHabits);
        setHabits(nextHabits);
      } catch (error) {
        setSyncError(error.message);
      } finally {
        setIsSyncing(false);
      }
    },
    [isAuthenticated, isDemoMode, sheetId, writeHabitsToSheet]
  );

  const fetchUserEmail = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return;
      const profile = await response.json();
      setUserEmail(profile.email ?? "");
    } catch {
      setUserEmail("");
    }
  }, [accessToken]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      if (!oauthConfigured) return;
      try {
        await loadGoogleIdentityScript();
        if (!active) return;
        setTokenClientReady(true);
      } catch (error) {
        if (!active) return;
        setAuthError(error.message);
      }
    };

    init();
    return () => {
      active = false;
    };
  }, [oauthConfigured]);

  useEffect(() => {
    if (accessToken) {
      fetchUserEmail();
    }
  }, [accessToken, fetchUserEmail]);

  useEffect(() => {
    if (!tokenClientReady || !oauthConfigured) return;
    if (isDemoMode) return;
    if (accessToken) return;
    getFreshAccessToken("")
      .then(() => undefined)
      .catch(() => undefined);
  }, [getFreshAccessToken, oauthConfigured, tokenClientReady, isDemoMode, accessToken]);

  useEffect(() => {
    loadHabits(sheetId);
  }, [loadHabits, sheetId, isAuthenticated, isDemoMode]);

  const signIn = async () => {
    setAuthError("");
    try {
      if (isDemoMode) {
        setIsDemoMode(false);
      }
      await getFreshAccessToken("consent");
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const signOut = () => {
    if (window.google?.accounts?.oauth2 && accessToken) {
      window.google.accounts.oauth2.revoke(accessToken);
    }
    setAccessToken("");
    setIsAuthenticated(false);
    setUserEmail("");
    setHabits([]);
    setEditingHabit(null);
  };

  const startDemoMode = () => {
    setIsDemoMode(true);
    setIsAuthenticated(false);
    setAccessToken("");
    setAuthError("");
    const demoHabits = readDemoHabits();
    saveDemoHabits(demoHabits);
    setHabits(demoHabits);
    setEditingHabit(null);
  };

  const stopDemoMode = () => {
    setIsDemoMode(false);
    setHabits([]);
    setEditingHabit(null);
  };

  const configureSheet = async (nextSheetId) => {
    const cleanedSheetId = nextSheetId.trim();
    setSheetId(cleanedSheetId);
    setEditingHabit(null);
    setSyncError("");

    if (typeof window !== "undefined") {
      if (cleanedSheetId) {
        window.localStorage.setItem(SHEET_ID_KEY, cleanedSheetId);
      } else {
        window.localStorage.removeItem(SHEET_ID_KEY);
      }
    }

    if (!cleanedSheetId) {
      setHabits([]);
      return;
    }

    await loadHabits(cleanedSheetId);
  };

  const clearSheet = () => {
    configureSheet("");
  };

  const refreshFromSheet = () => {
    loadHabits(sheetId);
  };

  const addHabit = (habit) => {
    const nextHabits = [
      ...habits,
      normalizeHabit({
        ...habit,
        id: `h${Date.now()}`,
      }),
    ];
    writeHabits(nextHabits);
  };

  const updateHabit = (updatedHabit) => {
    const nextHabits = habits.map((habit) =>
      habit.id === updatedHabit.id ? normalizeHabit(updatedHabit) : habit
    );
    writeHabits(nextHabits);
  };

  const deleteHabit = (id) => {
    const nextHabits = habits.filter((habit) => habit.id !== id);
    writeHabits(nextHabits);
    if (editingHabit?.id === id) {
      setEditingHabit(null);
    }
  };

  const toggleCompletion = (habitId, date = todayISO()) => {
    const nextHabits = habits.map((habit) => {
      if (habit.id !== habitId) return habit;
      if (habit.type === "timed") return habit;
      const completions = { ...habit.completions };
      completions[date] = !completions[date];
      return { ...habit, completions };
    });
    writeHabits(nextHabits);
  };

  const logTimedCompletion = (habitId, date = todayISO()) => {
    const nextHabits = habits.map((habit) => {
      if (habit.id !== habitId || habit.type !== "timed") return habit;
      const logState = getTimedLogState(habit, date);
      if (!logState.canLogNow) return habit;

      const timedLogs = { ...(habit.timedLogs ?? {}) };
      const existingLogs = Array.isArray(timedLogs[date]) ? [...timedLogs[date]] : [];
      const validExistingLogs = existingLogs.filter(
        (entry) => entry && typeof entry === "object" && Number.isInteger(entry.slotIndex)
      );
      const nextLogs = [
        ...validExistingLogs,
        { slotIndex: logState.activeSlotIndex, completedAt: new Date().toISOString() },
      ].sort((a, b) => a.slotIndex - b.slotIndex);
      timedLogs[date] = nextLogs;

      const goal = getTimedDailyGoal(habit, date);
      const progress = nextLogs.length;
      const timedProgress = { ...habit.timedProgress, [date]: progress };
      const completions = { ...habit.completions };
      if (progress >= goal && goal > 0) {
        completions[date] = true;
      } else {
        delete completions[date];
      }

      return { ...habit, timedLogs, timedProgress, completions };
    });
    writeHabits(nextHabits);
  };

  const undoTimedCompletion = (habitId, date = todayISO()) => {
    const nextHabits = habits.map((habit) => {
      if (habit.id !== habitId || habit.type !== "timed") return habit;
      const timedLogs = { ...(habit.timedLogs ?? {}) };
      const currentLogs = Array.isArray(timedLogs[date]) ? [...timedLogs[date]] : [];
      const normalizedSlotIndices = getNormalizedTimedLogsForDate(habit, date);
      if (normalizedSlotIndices.length === 0) return habit;
      const lastSlotIndex = normalizedSlotIndices[normalizedSlotIndices.length - 1];
      const nextLogs = currentLogs
        .filter((entry) => entry && typeof entry === "object" && Number.isInteger(entry.slotIndex))
        .filter((entry) => entry.slotIndex !== lastSlotIndex);
      timedLogs[date] = nextLogs;

      const goal = getTimedDailyGoal(habit, date);
      const timedProgress = { ...habit.timedProgress, [date]: nextLogs.length };
      const completions = { ...habit.completions };
      if (nextLogs.length >= goal && goal > 0) {
        completions[date] = true;
      } else {
        delete completions[date];
      }

      return { ...habit, timedLogs, timedProgress, completions };
    });
    writeHabits(nextHabits);
  };

  const toggleSkipTimedDate = (habitId, date = todayISO()) => {
    const nextHabits = habits.map((habit) => {
      if (habit.id !== habitId || habit.type !== "timed") return habit;
      const skippedDates = { ...(habit.skippedDates ?? {}) };
      const willSkip = !Boolean(skippedDates[date]);
      if (willSkip) {
        skippedDates[date] = true;
      } else {
        delete skippedDates[date];
      }

      const completions = { ...habit.completions };
      if (willSkip) {
        completions[date] = true;
      } else {
        const goal = getTimedDailyGoal({ ...habit, skippedDates }, date);
        const progress = getTimedProgressCount(habit, date);
        if (goal > 0 && progress >= goal) {
          completions[date] = true;
        } else {
          delete completions[date];
        }
      }

      return { ...habit, skippedDates, completions };
    });
    writeHabits(nextHabits);
  };

  const value = useMemo(
    () => ({
      habits,
      editingHabit,
      sheetId,
      hasSheet,
      isSyncing,
      syncError,
      isDemoMode,
      setEditingHabit,
      configureSheet,
      clearSheet,
      refreshFromSheet,
      addHabit,
      updateHabit,
      deleteHabit,
      toggleCompletion,
      logTimedCompletion,
      undoTimedCompletion,
      toggleSkipTimedDate,
      getTimedDailyGoal,
      getTimedProgressCount,
      getTimedCompletedSlotIndices,
      getTimedLogState,
      getScheduleMinutes,
      isHabitDoneOnDate,
      isTimedHabitScheduledOnDate,
      oauthConfigured,
      tokenClientReady,
      isAuthenticated,
      authError,
      userEmail,
      signIn,
      signOut,
      startDemoMode,
      stopDemoMode,
    }),
    [
      habits,
      editingHabit,
      sheetId,
      hasSheet,
      isSyncing,
      syncError,
      isDemoMode,
      oauthConfigured,
      tokenClientReady,
      isAuthenticated,
      authError,
      userEmail,
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DEMO_MODE_KEY, isDemoMode ? "true" : "false");
  }, [isDemoMode]);

  return <HabitContext.Provider value={value}>{children}</HabitContext.Provider>;
}

export const useHabits = () => {
  const context = useContext(HabitContext);
  if (!context) {
    throw new Error("useHabits must be used within HabitProvider");
  }
  return context;
};
