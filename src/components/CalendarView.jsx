import { useMemo, useState } from "react";
import { FaXmark } from "react-icons/fa6";
import { useHabits } from "../state/HabitContext.jsx";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (value) => String(value).padStart(2, "0");
const toISO = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

const toReadableDate = (isoDate) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
};

export default function CalendarView() {
  const { habits, isHabitDoneOnDate } = useHabits();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const [selectedDate, setSelectedDate] = useState(null);

  const { cells, monthLabel } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay.getDay();
    const cellData = [];

    for (let i = 0; i < startOffset; i += 1) cellData.push({ type: "empty", key: `empty-${i}` });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateISO = toISO(year, month, day);
      const completions = habits.filter((habit) => isHabitDoneOnDate(habit, dateISO));
      cellData.push({ type: "day", key: dateISO, day, dateISO, completions });
    }

    return {
      cells: cellData,
      monthLabel: today.toLocaleString("default", { month: "long", year: "numeric" }),
    };
  }, [habits, month, year, today, isHabitDoneOnDate]);

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{monthLabel}</h2>
            <p className="text-sm text-slate-600">Track completions by date</p>
          </div>
          <div className="text-sm text-slate-600">Tap any date to inspect completions</div>
        </header>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekdayLabels.map((label) => (
            <div key={label} className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
              {label}
            </div>
          ))}
          {cells.map((cell) =>
            cell.type === "empty" ? (
              <div key={cell.key} className="h-16 rounded-lg sm:h-24" />
            ) : (
              <button
                key={cell.key}
                type="button"
                className="flex h-16 flex-col items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-left hover:bg-slate-100 sm:h-24 sm:items-start sm:p-2"
                onClick={() => setSelectedDate(cell)}
              >
                <div className="text-xs font-semibold text-slate-800 sm:text-sm">{cell.day}</div>
                <div className="flex flex-wrap justify-center gap-1 sm:justify-start">
                  {cell.completions.slice(0, 4).map((habit) => (
                    <span
                      key={`${cell.dateISO}-${habit.id}`}
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: habit.color }}
                      title={`${habit.name} completed`}
                    />
                  ))}
                  {cell.completions.length === 0 && <span className="h-2 w-2 rounded-full bg-slate-300" />}
                </div>
              </button>
            )
          )}
        </div>
      </section>

      {selectedDate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setSelectedDate(null)}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{toReadableDate(selectedDate.dateISO)}</h3>
              <button
                type="button"
                className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
                onClick={() => setSelectedDate(null)}
              >
                <FaXmark />
              </button>
            </div>
            {selectedDate.completions.length > 0 ? (
              <ul className="mt-3 grid gap-2">
                {selectedDate.completions.map((habit) => (
                  <li key={`${selectedDate.dateISO}-${habit.id}`} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: habit.color }} aria-hidden="true" />
                    <span>{habit.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No habits completed on this date.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
