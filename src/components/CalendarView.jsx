import { useMemo, useState } from "react";
import { useHabits } from "../state/HabitContext.jsx";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (value) => String(value).padStart(2, "0");

const toISO = (year, month, day) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

const toReadableDate = (isoDate) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
};

export default function CalendarView() {
  const { habits } = useHabits();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const [selectedDate, setSelectedDate] = useState(null);

  const { cells, monthLabel } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay.getDay();

    const cellData = [];
    for (let i = 0; i < startOffset; i += 1) {
      cellData.push({ type: "empty", key: `empty-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateISO = toISO(year, month, day);
      const completions = habits.filter((habit) => habit.completions?.[dateISO]);
      cellData.push({
        type: "day",
        key: dateISO,
        day,
        dateISO,
        completions,
      });
    }

    const monthLabelValue = today.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    return { cells: cellData, monthLabel: monthLabelValue };
  }, [habits, month, year, today]);

  return (
    <>
      <section className="card calendar">
        <header className="calendar-header">
          <div>
            <h2>{monthLabel}</h2>
            <p>Track completions by date</p>
          </div>
          <div className="calendar-legend">
            <span className="legend-dot" />
            Completion logged
          </div>
        </header>

        <div className="calendar-grid">
          {weekdayLabels.map((label) => (
            <div key={label} className="calendar-weekday">
              {label}
            </div>
          ))}
          {cells.map((cell) =>
            cell.type === "empty" ? (
              <div key={cell.key} className="calendar-cell empty" />
            ) : (
              <button
                key={cell.key}
                type="button"
                className="calendar-cell calendar-cell--button"
                onClick={() => setSelectedDate(cell)}
              >
                <div className="calendar-day">{cell.day}</div>
                <div className="calendar-dots">
                  {cell.completions.map((habit) => (
                    <span
                      key={`${cell.dateISO}-${habit.id}`}
                      className="dot"
                      style={{ backgroundColor: habit.color }}
                      title={`${habit.name} completed`}
                    />
                  ))}
                  {cell.completions.length === 0 && (
                    <span className="dot placeholder" />
                  )}
                </div>
                <div className="calendar-count">
                  {cell.completions.length > 0
                    ? `${cell.completions.length} done`
                    : "No entries"}
                </div>
              </button>
            )
          )}
        </div>
      </section>

      {selectedDate && (
        <div className="calendar-modal" onClick={() => setSelectedDate(null)}>
          <div className="calendar-modal__card" onClick={(event) => event.stopPropagation()}>
            <div className="calendar-modal__header">
              <h3>{toReadableDate(selectedDate.dateISO)}</h3>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setSelectedDate(null)}
              >
                Close
              </button>
            </div>
            {selectedDate.completions.length > 0 ? (
              <ul className="calendar-modal__list">
                {selectedDate.completions.map((habit) => (
                  <li key={`${selectedDate.dateISO}-${habit.id}`}>
                    <span
                      className="dot"
                      style={{ backgroundColor: habit.color }}
                      aria-hidden="true"
                    />
                    <span>{habit.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No habits completed on this date.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
