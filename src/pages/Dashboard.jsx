import { useEffect, useMemo, useState } from "react";
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

  let streak = 0;
  const cursor = normalizeDate(today);

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!completions[key]) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
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

const getHeroQuote = (totalHabits, longestStreak, completionRate) => {
  if (totalHabits === 0) return "Start one habit today. Momentum begins with one step.";
  if (longestStreak >= 21) return "Elite consistency. You are building a long-term identity.";
  if (longestStreak >= 10) return "Strong rhythm. Protect this streak and keep compounding.";
  if (longestStreak >= 5) return "Great progress. Your routine is taking shape.";
  if (completionRate >= 70) return "Solid daily execution. Keep the pressure steady.";
  if (longestStreak > 0) return "You are on the board. Repeat today and raise the baseline.";
  return "Focus on small wins. The streaks will follow.";
};

export default function Dashboard() {
  const { habits } = useHabits();
  const today = todayISO();
  const [selectedHabitId, setSelectedHabitId] = useState("");

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
      return { ...day, completed, rate, isToday: day.iso === today };
    });

    const habitStreaks = habits
      .map((habit) => {
        const longest = getLongestStreak(habit.completions);
        const current = getCurrentStreak(habit.completions, today);
        return {
          id: habit.id,
          name: habit.name,
          color: habit.color,
          longest,
          current,
        };
      })
      .sort((a, b) => b.longest - a.longest || b.current - a.current);

    const highestStreakHabit = habitStreaks[0] ?? null;

    return {
      total,
      completedToday,
      completionRate,
      longestStreak,
      weeklyCompletion,
      habitStreaks,
      highestStreakHabit,
    };
  }, [habits, today]);

  useEffect(() => {
    if (stats.habitStreaks.length === 0) {
      setSelectedHabitId("");
      return;
    }
    const exists = stats.habitStreaks.some((habit) => habit.id === selectedHabitId);
    if (!exists) {
      setSelectedHabitId(stats.habitStreaks[0].id);
    }
  }, [selectedHabitId, stats.habitStreaks]);

  const selectedHabit =
    stats.habitStreaks.find((habit) => habit.id === selectedHabitId) ?? stats.habitStreaks[0];
  const heroQuote = getHeroQuote(stats.total, stats.longestStreak, stats.completionRate);

  return (
    <section className="dashboard">
      <div className="dashboard-hero">
        <div>
          <h2>Your momentum</h2>
          <p>{heroQuote}</p>
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
        <div className="wellbeing-chart">
          <div className="wellbeing-scale">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>
          <div className="weekly-chart__bars">
            {stats.weeklyCompletion.map((day) => (
              <div
                key={day.iso}
                className={day.isToday ? "weekly-bar today" : "weekly-bar"}
              >
                <div className="weekly-bar__track">
                  <div className="weekly-bar__fill" style={{ height: `${day.rate}%` }} />
                </div>
                <div className="weekly-bar__label">{day.label}</div>
                <div className="weekly-bar__value">{day.completed}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="reports-grid">
        <div className="card report-highlight">
          <h3>Top streak habit</h3>
          {stats.highestStreakHabit ? (
            <>
              <strong>{stats.highestStreakHabit.name}</strong>
              <p>
                Best: {stats.highestStreakHabit.longest} days, Current:{" "}
                {stats.highestStreakHabit.current} days
              </p>
            </>
          ) : (
            <p>No streak data yet. Complete habits to build your streak insights.</p>
          )}
        </div>

        <div className="card report-streaks">
          <h3>Habit streak report</h3>
          {stats.habitStreaks.length > 0 ? (
            <div className="streak-detail">
              <label className="streak-select-label" htmlFor="habit-streak-select">
                Choose habit
              </label>
              <select
                id="habit-streak-select"
                className="streak-select"
                value={selectedHabitId}
                onChange={(event) => setSelectedHabitId(event.target.value)}
              >
                {stats.habitStreaks.map((habit) => (
                  <option key={habit.id} value={habit.id}>
                    {habit.name}
                  </option>
                ))}
              </select>

              {selectedHabit && (
                <div className="streak-row">
                  <div className="streak-row__meta">
                    <span className="streak-row__name">{selectedHabit.name}</span>
                    <span className="streak-row__values">
                      {selectedHabit.current} current / {selectedHabit.longest} best
                    </span>
                  </div>
                  <div className="streak-row__track">
                    <div
                      className="streak-row__fill"
                      style={{
                        width: `${stats.longestStreak === 0 ? 0 : Math.round((selectedHabit.longest / stats.longestStreak) * 100)}%`,
                        backgroundColor: selectedHabit.color,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="empty">No habits available for streak analytics.</p>
          )}
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
