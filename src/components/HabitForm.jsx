import { useEffect, useMemo, useState } from "react";
import { useHabits } from "../state/HabitContext.jsx";

const colorPalette = ["#59a7ff", "#6dd3a9", "#f0b35c", "#e67fa2", "#8b7dff"];

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
          value={form.name}
          onChange={handleChange}
          placeholder="Example: Morning walk"
          required
        />
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
