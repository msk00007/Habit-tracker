import { useHabits } from "../state/HabitContext.jsx";

const todayISO = () => new Date().toISOString().slice(0, 10);
const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeDate = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const getLongestStreak = (completions = {}) => {
  const dates = Object.entries(completions)
    .filter(([, isDone]) => Boolean(isDone))
    .map(([date]) => date)
    .sort();
  if (dates.length === 0) return 0;

  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i += 1) {
    const prev = normalizeDate(dates[i - 1]);
    const curr = normalizeDate(dates[i]);
    const diffDays = Math.round((curr - prev) / DAY_MS);
    if (diffDays === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else if (diffDays > 1) {
      current = 1;
    }
  }
  return longest;
};

const getCurrentStreak = (completions = {}, today) => {
  if (!completions?.[today]) return 0;
  const cursor = normalizeDate(today);
  let streak = 0;
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!completions[key]) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

export default function HabitList() {
  const { habits, setEditingHabit, toggleCompletion, deleteHabit } = useHabits();
  const today = todayISO();

  if (habits.length === 0) {
    return <div className="card empty">No habits yet. Add one to begin.</div>;
  }

  return (
    <div className="habit-list">
      {habits.map((habit) => {
        const isDone = habit.completions?.[today];
        const currentStreak = getCurrentStreak(habit.completions, today);
        const bestStreak = getLongestStreak(habit.completions);
        return (
          <article key={habit.id} className="card habit-card">
            <div className="habit-card__header">
              <div
                className="habit-color"
                style={{ backgroundColor: habit.color }}
                aria-hidden="true"
              />
              <div>
                <h3>{habit.name}</h3>
                <p>{habit.description}</p>
              </div>
            </div>
            <div className="habit-meta">
              <span className="tag">{habit.frequency}</span>
              <span className="tag">
                {currentStreak} current / {bestStreak} best
              </span>
              <span className={isDone ? "status done" : "status pending"}>
                {isDone ? "Completed today" : "Not completed"}
              </span>
            </div>
            <div className="habit-actions">
              <button
                className="btn primary"
                onClick={() => toggleCompletion(habit.id)}
              >
                {isDone ? "Undo" : "Mark done"}
              </button>
              <button
                className="btn ghost"
                onClick={() => setEditingHabit(habit)}
              >
                Edit
              </button>
              <button className="btn danger" onClick={() => deleteHabit(habit.id)}>
                Delete
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
