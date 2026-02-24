import { useEffect, useState } from "react";
import { FaCheck, FaForward, FaPen, FaRotateLeft, FaTrash, FaXmark } from "react-icons/fa6";
import { useHabits } from "../state/HabitContext.jsx";
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

const actionButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40";

const formatTimeLabel = (date) => {
  try {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
};

export default function HabitList() {
  const {
    habits,
    setEditingHabit,
    toggleCompletion,
    deleteHabit,
    logTimedCompletion,
    undoTimedCompletion,
    toggleSkipTimedDate,
    getTimedDailyGoal,
    getTimedProgressCount,
    getScheduleMinutes,
    getTimedLogState,
    isHabitDoneOnDate,
    isTimedHabitScheduledOnDate,
  } = useHabits();
  const [now, setNow] = useState(() => new Date());
  const today = now.toISOString().slice(0, 10);
  const todayWeekday = new Date(`${today}T00:00:00`).getDay();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, []);

  if (habits.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
        No habits yet. Add one to begin.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {habits.map((habit) => {
        const isTimed = habit.type === "timed";
        const isDone = isHabitDoneOnDate(habit, today);
        const currentStreak = getCurrentStreak(habit.completions, today);
        const bestStreak = getLongestStreak(habit.completions);
        const timedGoal = getTimedDailyGoal(habit, today);
        const timedProgress = getTimedProgressCount(habit, today);
        const scheduleMinutes = getScheduleMinutes(habit);
        const isScheduledToday = isTimedHabitScheduledOnDate(habit, today);
        const isSkippedToday =
          Boolean(habit.skippedDates?.[today]) || habit.skipWeekdays?.includes(todayWeekday);
        const logState = getTimedLogState(habit, today);

        const previewSchedule = scheduleMinutes
          .slice(0, 3)
          .map((minute) => {
            const hours = Math.floor(minute / 60);
            const mins = minute % 60;
            const date = new Date();
            date.setHours(hours, mins, 0, 0);
            return formatTimeLabel(date);
          })
          .join(" • ");

        return (
          <article key={habit.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="h-11 w-2 rounded-full" style={{ backgroundColor: habit.color }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-slate-900">{habit.name}</h3>
                <p className="mt-0.5 text-sm text-slate-600">{habit.description || "No description"}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-cyan-100 px-2.5 py-1 font-semibold text-cyan-800">
                {isTimed ? "Timed habit" : habit.frequency}
              </span>
              {isTimed ? (
                <>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    Every {habit.intervalMinutes}m ({timedProgress}/{timedGoal})
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    {habit.startTime} - {habit.endTime}
                  </span>
                  {previewSchedule && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                      {previewSchedule}
                    </span>
                  )}
                </>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                  {currentStreak} current / {bestStreak} best
                </span>
              )}
              <span
                className={`rounded-full px-2.5 py-1 font-semibold ${
                  isDone ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {isTimed
                  ? isSkippedToday
                    ? "Skipped today"
                    : isDone
                      ? "All slots complete"
                      : isScheduledToday
                        ? logState.canLogNow
                          ? "Current slot open"
                          : "Waiting for slot"
                        : "Not scheduled today"
                  : isDone
                    ? "Completed today"
                    : "Pending"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isTimed ? (
                <>
                  <button
                    className={actionButtonClass}
                    onClick={() => logTimedCompletion(habit.id)}
                    disabled={!logState.canLogNow || isSkippedToday}
                    aria-label="Log timed completion"
                    title="Log timed completion"
                  >
                    <FaCheck />
                  </button>
                  <button
                    className={actionButtonClass}
                    onClick={() => undoTimedCompletion(habit.id)}
                    disabled={timedProgress === 0}
                    aria-label="Undo timed completion"
                    title="Undo timed completion"
                  >
                    <FaRotateLeft />
                  </button>
                  <button
                    className={actionButtonClass}
                    onClick={() => toggleSkipTimedDate(habit.id)}
                    aria-label={isSkippedToday ? "Unskip today" : "Skip today"}
                    title={isSkippedToday ? "Unskip today" : "Skip today"}
                  >
                    {isSkippedToday ? <FaXmark /> : <FaForward />}
                  </button>
                </>
              ) : (
                <button
                  className={actionButtonClass}
                  onClick={() => toggleCompletion(habit.id)}
                  aria-label={isDone ? "Undo completion" : "Mark completed"}
                  title={isDone ? "Undo completion" : "Mark completed"}
                >
                  {isDone ? <FaRotateLeft /> : <FaCheck />}
                </button>
              )}
              <button
                className={actionButtonClass}
                onClick={() => setEditingHabit(habit)}
                aria-label="Edit habit"
                title="Edit habit"
              >
                <FaPen />
              </button>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                onClick={() => deleteHabit(habit.id)}
                aria-label="Delete habit"
                title="Delete habit"
              >
                <FaTrash />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
