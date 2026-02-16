import HabitForm from "../components/HabitForm.jsx";
import HabitList from "../components/HabitList.jsx";
import SheetConfig from "../components/SheetConfig.jsx";
import { useHabits } from "../state/HabitContext.jsx";

export default function Habits() {
  const { hasSheet, isAuthenticated, isDemoMode } = useHabits();

  return (
    <section className="habits-layout">
      <SheetConfig />
      {(isDemoMode || isAuthenticated) && hasSheet ? (
        <div className="habits-page">
          <HabitForm />
          <HabitList />
        </div>
      ) : isAuthenticated && !isDemoMode ? (
        <div className="card empty">
          Enter your Google Sheet ID to load and manage your habits.
        </div>
      ) : (
        <div className="card empty">
          Sign in with Google or try demo mode to start using HabitTracker.
        </div>
      )}
    </section>
  );
}
