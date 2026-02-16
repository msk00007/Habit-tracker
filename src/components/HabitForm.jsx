import { useEffect, useMemo, useState } from "react";
import { useHabits } from "../state/HabitContext.jsx";

const colorPalette = ["#59a7ff", "#6dd3a9", "#f0b35c", "#e67fa2", "#8b7dff"];

const habitSuggestions = [
  { name: "Morning walk", description: "20-minute light walk", frequency: "Daily" },
  { name: "Medication check", description: "Take medicines on time", frequency: "Daily" },
  { name: "Breathing exercise", description: "10 minutes of deep breathing", frequency: "Daily" },
  { name: "Meal planning", description: "Plan meals for next day", frequency: "Daily" },
  { name: "Kitchen reset", description: "Clean kitchen before bed", frequency: "Daily" },
  { name: "Budget tracking", description: "Log household expenses", frequency: "Weekdays" },
  { name: "Focused study", description: "45-minute distraction-free study block", frequency: "Daily" },
  { name: "Revision notes", description: "Review class notes for 15 minutes", frequency: "Weekdays" },
  { name: "Practice problems", description: "Solve 10 questions", frequency: "3x per week" },
  { name: "Top 3 priorities", description: "List and finish top tasks for the day", frequency: "Weekdays" },
  { name: "Inbox zero sprint", description: "15-minute email cleanup", frequency: "Weekdays" },
  { name: "Stand and stretch", description: "Short break every 2 hours", frequency: "Daily" },
];

const emptyForm = {
  name: "",
  description: "",
  frequency: "Daily",
  color: colorPalette[0],
};

export default function HabitForm() {
  const { addHabit, updateHabit, editingHabit, setEditingHabit } = useHabits();
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (editingHabit) {
      setForm({
        name: editingHabit.name,
        description: editingHabit.description,
        frequency: editingHabit.frequency,
        color: editingHabit.color ?? colorPalette[0],
      });
    } else {
      setForm(emptyForm);
    }
  }, [editingHabit]);

  const isEditing = useMemo(() => Boolean(editingHabit), [editingHabit]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleNameChange = (event) => {
    const value = event.target.value;
    const matchedHabit = habitSuggestions.find(
      (suggestion) => suggestion.name.toLowerCase() === value.toLowerCase()
    );

    setForm((prev) => ({
      ...prev,
      name: value,
      description: matchedHabit ? matchedHabit.description : prev.description,
      frequency: matchedHabit ? matchedHabit.frequency : prev.frequency,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    if (isEditing) {
      updateHabit({
        ...editingHabit,
        ...form,
      });
      setEditingHabit(null);
    } else {
      addHabit(form);
    }
    setForm(emptyForm);
  };

  const handleCancel = () => {
    setEditingHabit(null);
    setForm(emptyForm);
  };

  return (
    <form className="card habit-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h2>{isEditing ? "Edit habit" : "Add a habit"}</h2>
        <p>Define what you want to build into your day.</p>
      </div>
      <label>
        Habit name
        <input
          type="text"
          name="name"
          list="habit-name-suggestions"
          value={form.name}
          onChange={handleNameChange}
          placeholder="Example: Morning walk"
          required
        />
        <datalist id="habit-name-suggestions">
          {habitSuggestions.map((suggestion) => (
            <option key={suggestion.name} value={suggestion.name} />
          ))}
        </datalist>
      </label>
      <label>
        Description
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Short note to keep you motivated"
          rows={3}
        />
      </label>
      <label>
        Frequency
        <select name="frequency" value={form.frequency} onChange={handleChange}>
          <option>Daily</option>
          <option>Weekdays</option>
          <option>Weekends</option>
          <option>3x per week</option>
          <option>Custom</option>
        </select>
      </label>
      <label>
        Color
        <div className="color-row">
          {colorPalette.map((color) => (
            <button
              key={color}
              type="button"
              className={form.color === color ? "color-dot active" : "color-dot"}
              style={{ backgroundColor: color }}
              onClick={() => setForm((prev) => ({ ...prev, color }))}
              aria-label={`Select ${color}`}
            />
          ))}
        </div>
      </label>
      <div className="form-actions">
        <button type="submit" className="btn primary">
          {isEditing ? "Save changes" : "Add habit"}
        </button>
        {isEditing && (
          <button type="button" className="btn ghost" onClick={handleCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
