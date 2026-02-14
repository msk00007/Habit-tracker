import { useHabits } from "../state/HabitContext.jsx";

const todayISO = () => new Date().toISOString().slice(0, 10);

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
