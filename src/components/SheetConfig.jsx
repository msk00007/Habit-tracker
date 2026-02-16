import { useEffect, useState } from "react";
import { useHabits } from "../state/HabitContext.jsx";

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

  useEffect(() => {
    setInputValue(sheetId);
  }, [sheetId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await configureSheet(inputValue);
  };

  return (
    <section className="card sheet-config">
      <div>
        <h2>Google Sheets Sync</h2>
        <p>Sign in, then enter your Sheet ID. Data is stored in your own sheet.</p>
      </div>

      <div className="sheet-config__actions">
        {isDemoMode ? (
          <>
            <span className="auth-pill">Demo mode</span>
            <button type="button" className="btn ghost" onClick={stopDemoMode} disabled={isSyncing}>
              Exit demo
            </button>
          </>
        ) : isAuthenticated ? (
          <>
            <span className="auth-pill">Signed in{userEmail ? `: ${userEmail}` : ""}</span>
            <button type="button" className="btn ghost" onClick={signOut} disabled={isSyncing}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn primary"
              onClick={signIn}
              disabled={isSyncing || !tokenClientReady || !oauthConfigured}
            >
              Sign in with Google
            </button>
            <button type="button" className="btn ghost" onClick={startDemoMode} disabled={isSyncing}>
              Try demo
            </button>
          </>
        )}
      </div>

      {isAuthenticated && !isDemoMode && (
        <form className="sheet-config__form" onSubmit={handleSubmit}>
          {!hasSheet && (
            <div className="sheet-config__instructions">
              <h3>How to link your Google Sheet</h3>
              <ol>
                <li>Open Google Sheets and create or open a sheet.</li>
                <li>Copy the Sheet ID from the URL between <code>/d/</code> and <code>/edit</code>.</li>
                <li>Paste that ID below and click <strong>Connect sheet</strong>.</li>
              </ol>
            </div>
          )}
          <label htmlFor="sheet-id-input">Sheet ID</label>
          <input
            id="sheet-id-input"
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="1AbC...your-sheet-id"
          />
          <div className="sheet-config__actions">
            <button type="submit" className="btn primary" disabled={isSyncing}>
              {hasSheet ? "Update sheet" : "Connect sheet"}
            </button>
            {hasSheet && (
              <>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={refreshFromSheet}
                  disabled={isSyncing}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={clearSheet}
                  disabled={isSyncing}
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        </form>
      )}

      {!oauthConfigured && (
        <div className="sheet-config__note">
          Missing <code>VITE_GOOGLE_CLIENT_ID</code> in environment.
        </div>
      )}

      {authError && <div className="sheet-config__error">{authError}</div>}
      {!tokenClientReady && oauthConfigured && (
        <div className="sheet-config__status">Loading Google sign-in...</div>
      )}
      {isSyncing && <div className="sheet-config__status">Syncing with Google Sheets...</div>}
      {syncError && <div className="sheet-config__error">{syncError}</div>}
    </section>
  );
}
