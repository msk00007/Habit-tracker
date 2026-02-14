import { useMemo } from "react";
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

const getLastNDays = (count) => {
  const days = [];
  const now = new Date();

  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    days.push({
      iso: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("default", { weekday: "short" }),
    });
  }

  return days;
};

export default function Dashboard() {
  const { habits } = useHabits();
  const today = todayISO();

  const stats = useMemo(() => {
    const total = habits.length;
    const completedToday = habits.filter((habit) => habit.completions?.[today])
      .length;
    const completionRate = total === 0 ? 0 : Math.round((completedToday / total) * 100);
    const longestStreak = habits.reduce(
      (max, habit) => Math.max(max, getLongestStreak(habit.completions)),
      0
    );

    const weekDays = getLastNDays(7);
    const weeklyCompletion = weekDays.map((day) => {
      const completed = habits.filter((habit) => habit.completions?.[day.iso]).length;
      const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
      return { ...day, completed, rate };
    });

    return {
      total,
      completedToday,
      completionRate,
      longestStreak,
      weeklyCompletion,
    };
  }, [habits, today]);

  return (
    <section className="dashboard">
      <div className="dashboard-hero">
        <div>
          <h2>Your momentum</h2>
          <p>Focus on small wins. The streaks will follow.</p>
        </div>
        <div className="hero-date">
          {new Date().toLocaleDateString("default", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      <div className="stats-grid">
        <div className="card stat">
          <h3>Total habits</h3>
          <strong>{stats.total}</strong>
        </div>
        <div className="card stat">
          <h3>Completed today</h3>
          <strong>{stats.completedToday}</strong>
        </div>
        <div className="card stat">
          <h3>Completion rate</h3>
          <strong>{stats.completionRate}%</strong>
        </div>
        <div className="card stat">
          <h3>Longest streak</h3>
          <strong>{stats.longestStreak} days</strong>
        </div>
      </div>

      <div className="card weekly-chart">
        <div className="weekly-chart__header">
          <h3>Weekly completion</h3>
          <span>Last 7 days</span>
        </div>
        <div className="weekly-chart__bars">
          {stats.weeklyCompletion.map((day) => (
            <div key={day.iso} className="weekly-bar">
              <div className="weekly-bar__track">
                <div className="weekly-bar__fill" style={{ height: `${day.rate}%` }} />
              </div>
              <div className="weekly-bar__value">{day.completed}</div>
              <div className="weekly-bar__label">{day.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card summary">
        <h3>Today at a glance</h3>
        <ul className="summary-list">
          {habits.map((habit) => (
            <li key={habit.id}>
              <span
                className={habit.completions?.[today] ? "summary-dot done" : "summary-dot"}
                style={{ backgroundColor: habit.color }}
              />
              <div>
                <div className="summary-title">{habit.name}</div>
                <div className="summary-status">
                  {habit.completions?.[today] ? "Completed" : "Pending"}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
