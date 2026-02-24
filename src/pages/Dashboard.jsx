import { useEffect, useMemo, useState } from "react";
import { FaChartColumn, FaClock, FaFire, FaListUl } from "react-icons/fa6";
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

export default function Dashboard() {
  const {
    habits,
    isHabitDoneOnDate,
    getScheduleMinutes,
    getTimedDailyGoal,
    getTimedProgressCount,
    getTimedCompletedSlotIndices,
  } = useHabits();
  const today = todayISO();
  const [selectedHabitId, setSelectedHabitId] = useState("");
  const [selectedTimedDate, setSelectedTimedDate] = useState(today);
  const [selectedTimedHabitId, setSelectedTimedHabitId] = useState("");

  const stats = useMemo(() => {
    const total = habits.length;
    const completedToday = habits.filter((habit) => isHabitDoneOnDate(habit, today)).length;
    const completionRate = total === 0 ? 0 : Math.round((completedToday / total) * 100);
    const longestStreak = habits.reduce((max, habit) => Math.max(max, getLongestStreak(habit.completions)), 0);

    const weekDays = getLastNDays(7);
    const weeklyCompletion = weekDays.map((day) => {
      const completed = habits.filter((habit) => isHabitDoneOnDate(habit, day.iso)).length;
      const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
      return { ...day, completed, rate, isToday: day.iso === today };
    });

    const habitStreaks = habits
      .map((habit) => ({
        id: habit.id,
        name: habit.name,
        color: habit.color,
        longest: getLongestStreak(habit.completions),
        current: getCurrentStreak(habit.completions, today),
      }))
      .sort((a, b) => b.longest - a.longest || b.current - a.current);

    return {
      total,
      completedToday,
      completionRate,
      longestStreak,
      weeklyCompletion,
      habitStreaks,
      highestStreakHabit: habitStreaks[0] ?? null,
    };
  }, [habits, today, isHabitDoneOnDate]);

  const timedHabits = useMemo(() => habits.filter((habit) => habit.type === "timed"), [habits]);

  useEffect(() => {
    if (timedHabits.length === 0) return setSelectedTimedHabitId("");
    if (!timedHabits.some((habit) => habit.id === selectedTimedHabitId)) {
      setSelectedTimedHabitId(timedHabits[0].id);
    }
  }, [selectedTimedHabitId, timedHabits]);

  useEffect(() => {
    if (stats.habitStreaks.length === 0) return setSelectedHabitId("");
    if (!stats.habitStreaks.some((habit) => habit.id === selectedHabitId)) {
      setSelectedHabitId(stats.habitStreaks[0].id);
    }
  }, [selectedHabitId, stats.habitStreaks]);

  const selectedHabit = stats.habitStreaks.find((habit) => habit.id === selectedHabitId) ?? stats.habitStreaks[0];
  const selectedTimedHabit = timedHabits.find((habit) => habit.id === selectedTimedHabitId) ?? timedHabits[0];
  const selectedTimedGoal = selectedTimedHabit ? getTimedDailyGoal(selectedTimedHabit, selectedTimedDate) : 0;
  const selectedTimedProgress = selectedTimedHabit ? getTimedProgressCount(selectedTimedHabit, selectedTimedDate) : 0;
  const selectedTimedWeekday = new Date(`${selectedTimedDate}T00:00:00`).getDay();
  const selectedTimedIsSkipped =
    Boolean(selectedTimedHabit?.skippedDates?.[selectedTimedDate]) ||
    Boolean(selectedTimedHabit?.skipWeekdays?.includes(selectedTimedWeekday));

  const selectedTimedSchedule = selectedTimedHabit ? getScheduleMinutes(selectedTimedHabit) : [];
  const selectedTimedCompletedSlots = selectedTimedHabit
    ? new Set(getTimedCompletedSlotIndices(selectedTimedHabit, selectedTimedDate))
    : new Set();
  const selectedTimedInterval = Number(selectedTimedHabit?.intervalMinutes ?? 30);
  const selectedDateStart = new Date(`${selectedTimedDate}T00:00:00`);
  const isSelectedDateToday = selectedTimedDate === today;
  const isSelectedDatePast = selectedDateStart < new Date(`${today}T00:00:00`);
  const now = new Date();

  const timedSlots = selectedTimedSchedule.map((minute, index) => {
    const slot = new Date(`${selectedTimedDate}T00:00:00`);
    slot.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    const done = !selectedTimedIsSkipped && selectedTimedCompletedSlots.has(index);
    const slotEnd = new Date(slot);
    slotEnd.setMinutes(slotEnd.getMinutes() + selectedTimedInterval);
    const missed =
      !selectedTimedIsSkipped && !done && (isSelectedDatePast || (isSelectedDateToday && now >= slotEnd));
    return {
      id: `${selectedTimedDate}-${minute}`,
      label: slot.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      status: selectedTimedIsSkipped ? "skipped" : done ? "done" : missed ? "missed" : "upcoming",
    };
  });

  const statCardClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

  return (
    <section className="grid gap-4">
      <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
        <h2 className="text-2xl font-semibold">Your momentum</h2>
        <p className="mt-1 text-sm text-slate-200">
          {new Date().toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={statCardClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total habits</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className={statCardClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed today</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.completedToday}</p>
        </div>
        <div className={statCardClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completion rate</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.completionRate}%</p>
        </div>
        <div className={statCardClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Longest streak</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.longestStreak} days</p>
        </div>
      </div>

      <div className={statCardClass}>
        <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
          <FaChartColumn /> Weekly completion
        </h3>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {stats.weeklyCompletion.map((day) => (
            <div key={day.iso} className="flex flex-col items-center gap-1">
              <div className="flex h-28 w-full items-end rounded-md bg-slate-100 p-1">
                <div
                  className={`w-full rounded ${day.isToday ? "bg-slate-900" : "bg-cyan-500"}`}
                  style={{ height: `${Math.max(4, day.rate)}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-600">{day.label}</span>
              <span className="text-xs text-slate-500">{day.completed}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={statCardClass}>
          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
            <FaFire /> Top streak habit
          </h3>
          {stats.highestStreakHabit ? (
            <div className="mt-3">
              <p className="text-lg font-semibold text-slate-900">{stats.highestStreakHabit.name}</p>
              <p className="text-sm text-slate-600">
                Best: {stats.highestStreakHabit.longest} days, Current: {stats.highestStreakHabit.current} days
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No streak data yet.</p>
          )}
        </div>

        <div className={statCardClass}>
          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
            <FaListUl /> Habit streak report
          </h3>
          {stats.habitStreaks.length > 0 ? (
            <div className="mt-3 grid gap-3">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-300 focus:ring"
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
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-700">
                    <span className="font-semibold">{selectedHabit.name}</span>
                    <span>
                      {selectedHabit.current} current / {selectedHabit.longest} best
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full"
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
            <p className="mt-3 text-sm text-slate-600">No habits available for streak analytics.</p>
          )}
        </div>
      </div>

      <div className={statCardClass}>
        <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
          <FaClock /> Timed habit tracker
        </h3>
        {timedHabits.length > 0 ? (
          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Day
                <input
                  type="date"
                  value={selectedTimedDate}
                  max={today}
                  onChange={(event) => setSelectedTimedDate(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-300 focus:ring"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Timed habit
                <select
                  value={selectedTimedHabitId}
                  onChange={(event) => setSelectedTimedHabitId(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-300 focus:ring"
                >
                  {timedHabits.map((habit) => (
                    <option key={habit.id} value={habit.id}>
                      {habit.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                Progress: {selectedTimedProgress}/{selectedTimedGoal}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                Streak: {selectedTimedHabit ? getCurrentStreak(selectedTimedHabit.completions, today) : 0} current /{" "}
                {selectedTimedHabit ? getLongestStreak(selectedTimedHabit.completions) : 0} best
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                Window: {selectedTimedHabit?.startTime} - {selectedTimedHabit?.endTime}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {timedSlots.length > 0 ? (
                timedSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className={`rounded-xl border px-3 py-2 text-xs ${
                      slot.status === "done"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : slot.status === "missed"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : slot.status === "skipped"
                            ? "border-slate-200 bg-slate-100 text-slate-600"
                            : "border-cyan-200 bg-cyan-50 text-cyan-700"
                    }`}
                  >
                    <p className="font-semibold">{slot.label}</p>
                    <p className="mt-1">
                      {slot.status === "done"
                        ? "Done"
                        : slot.status === "missed"
                          ? "Missed"
                          : slot.status === "skipped"
                            ? "Skipped"
                            : "Upcoming"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No slots for this schedule/day.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Add a timed habit to view day-level slot tracking.</p>
        )}
      </div>
    </section>
  );
}
