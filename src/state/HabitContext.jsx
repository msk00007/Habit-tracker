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
];
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

const normalizeHabit = (habit) => ({
  id: habit.id ?? `h${Date.now()}`,
  name: habit.name ?? "",
  description: habit.description ?? "",
  frequency: habit.frequency ?? "Daily",
  color: habit.color ?? "#59a7ff",
  completions: habit.completions ?? {},
});

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
        `/${targetSheetId}/values/${HABIT_SHEET_NAME}!A1:F1?valueInputOption=RAW`,
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
      const data = await apiRequest(`/${targetSheetId}/values/${HABIT_SHEET_NAME}!A2:F`);
      const values = data.values ?? [];

      return values.map((row) =>
        normalizeHabit({
          id: row[0],
          name: row[1],
          description: row[2],
          frequency: row[3],
          color: row[4],
          completions: parseCompletionJson(row[5]),
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
          ranges: [`${HABIT_SHEET_NAME}!A2:F`],
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
      ]);

      await apiRequest(
        `/${targetSheetId}/values/${HABIT_SHEET_NAME}!A2:F?valueInputOption=RAW`,
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
    getFreshAccessToken("")
      .then(() => undefined)
      .catch(() => undefined);
  }, [getFreshAccessToken, oauthConfigured, tokenClientReady, isDemoMode]);

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
      const completions = { ...habit.completions };
      completions[date] = !completions[date];
      return { ...habit, completions };
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
