import { useEffect, useState } from "react";
import { FaArrowRotateRight, FaGoogle, FaLink, FaPlugCircleXmark, FaXmark } from "react-icons/fa6";
import { useHabits } from "../state/HabitContext.jsx";

const cardClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export default function SheetConfig() {
  const {
    sheetId,
    hasSheet,
    isSyncing,
    syncError,
    oauthConfigured,
    tokenClientReady,
    isAuthenticated,
    isDemoMode,
    authError,
    userEmail,
    signIn,
    signOut,
    startDemoMode,
    stopDemoMode,
    configureSheet,
    clearSheet,
    refreshFromSheet,
  } = useHabits();

  const [inputValue, setInputValue] = useState(sheetId);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setInputValue(sheetId);
  }, [sheetId]);

  useEffect(() => {
    if (isAuthenticated || isDemoMode || hasSheet) {
      setIsExpanded(true);
    }
  }, [isAuthenticated, isDemoMode, hasSheet]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await configureSheet(inputValue);
  };

  if (!isExpanded) {
    return (
      <section className={cardClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Sheet setup</h2>
            <p className="mt-1 text-sm text-slate-600">Connect Google Sheets or use demo mode.</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => setIsExpanded(true)}
            aria-label="Open sheet setup"
          >
            <FaLink />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={cardClass}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Google Sheets Sync</h2>
          <p className="mt-1 text-sm text-slate-600">Sign in, then enter your Sheet ID.</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
          onClick={() => setIsExpanded(false)}
          aria-label="Close sheet setup"
        >
          <FaXmark />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isDemoMode ? (
          <>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
              Demo mode
            </span>
            <button
              type="button"
              className={`${btnBase} bg-slate-100 text-slate-800 hover:bg-slate-200`}
              onClick={stopDemoMode}
              disabled={isSyncing}
            >
              Exit demo
            </button>
          </>
        ) : isAuthenticated ? (
          <>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              Signed in{userEmail ? `: ${userEmail}` : ""}
            </span>
            <button
              type="button"
              className={`${btnBase} bg-slate-100 text-slate-800 hover:bg-slate-200`}
              onClick={signOut}
              disabled={isSyncing}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${btnBase} bg-slate-900 text-white hover:bg-slate-800`}
              onClick={signIn}
              disabled={isSyncing || !tokenClientReady || !oauthConfigured}
            >
              <FaGoogle /> Sign in with Google
            </button>
            <button
              type="button"
              className={`${btnBase} bg-slate-100 text-slate-800 hover:bg-slate-200`}
              onClick={startDemoMode}
              disabled={isSyncing}
            >
              Try demo
            </button>
          </>
        )}
      </div>

      {isAuthenticated && !isDemoMode && (
        <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          {!hasSheet && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">How to link your Google Sheet</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Create/open a Google Sheet.</li>
                <li>Copy the ID from between `/d/` and `/edit` in URL.</li>
                <li>Paste below and click Connect.</li>
              </ol>
            </div>
          )}
          <label htmlFor="sheet-id-input" className="text-sm font-semibold text-slate-700">
            Sheet ID
          </label>
          <input
            id="sheet-id-input"
            type="password"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="1AbC...your-sheet-id"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-300 focus:ring"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className={`${btnBase} bg-slate-900 text-white hover:bg-slate-800`}
              disabled={isSyncing}
            >
              <FaLink /> {hasSheet ? "Update sheet" : "Connect sheet"}
            </button>
            {hasSheet && (
              <>
                <button
                  type="button"
                  className={`${btnBase} bg-slate-100 text-slate-800 hover:bg-slate-200`}
                  onClick={refreshFromSheet}
                  disabled={isSyncing}
                >
                  <FaArrowRotateRight /> Refresh
                </button>
                <button
                  type="button"
                  className={`${btnBase} bg-rose-100 text-rose-700 hover:bg-rose-200`}
                  onClick={clearSheet}
                  disabled={isSyncing}
                >
                  <FaPlugCircleXmark /> Disconnect
                </button>
              </>
            )}
          </div>
        </form>
      )}

      {!oauthConfigured && (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Missing <code>VITE_GOOGLE_CLIENT_ID</code> in environment.
        </div>
      )}
      {authError && <div className="mt-3 text-sm text-rose-600">{authError}</div>}
      {!tokenClientReady && oauthConfigured && (
        <div className="mt-3 text-sm text-slate-600">Loading Google sign-in...</div>
      )}
      {isSyncing && <div className="mt-3 text-sm text-slate-600">Syncing with Google Sheets...</div>}
      {syncError && <div className="mt-3 text-sm text-rose-600">{syncError}</div>}
    </section>
  );
}
