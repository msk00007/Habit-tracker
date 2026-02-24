import { useEffect, useMemo, useState } from "react";
import { FaPlus, FaXmark } from "react-icons/fa6";
import { useHabits } from "../state/HabitContext.jsx";

const colorPalette = ["#59a7ff", "#6dd3a9", "#f0b35c", "#e67fa2", "#8b7dff"];
const todayISO = () => new Date().toISOString().slice(0, 10);

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
  type: "standard",
  frequency: "Daily",
  intervalMinutes: 30,
  startTime: "09:00",
  endTime: "21:00",
  skipWeekdays: [],
  color: colorPalette[0],
};

const weekdayOptions = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

const labelClass = "grid gap-1.5 text-sm font-semibold text-slate-700";
const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-300 focus:ring";

export default function HabitForm() {
  const { addHabit, updateHabit, editingHabit, setEditingHabit, getTimedDailyGoal } = useHabits();
  const [form, setForm] = useState(emptyForm);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (editingHabit) {
      setIsExpanded(true);
      setForm({
        name: editingHabit.name,
        description: editingHabit.description,
        type: editingHabit.type ?? "standard",
        frequency: editingHabit.frequency,
        intervalMinutes: editingHabit.intervalMinutes ?? 30,
        startTime: editingHabit.startTime ?? "09:00",
        endTime: editingHabit.endTime ?? "21:00",
        skipWeekdays: editingHabit.skipWeekdays ?? [],
        color: editingHabit.color ?? colorPalette[0],
      });
    } else {
      setForm(emptyForm);
    }
  }, [editingHabit]);

  const isEditing = useMemo(() => Boolean(editingHabit), [editingHabit]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === "intervalMinutes") {
      setForm((prev) => ({ ...prev, intervalMinutes: Number(value) || 1 }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSkipWeekdayChange = (dayValue) => {
    setForm((prev) => {
      const exists = prev.skipWeekdays.includes(dayValue);
      return {
        ...prev,
        skipWeekdays: exists
          ? prev.skipWeekdays.filter((value) => value !== dayValue)
          : [...prev.skipWeekdays, dayValue].sort((a, b) => a - b),
      };
    });
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
    if (form.type === "timed") {
      const [startHours, startMinutes] = form.startTime.split(":").map(Number);
      const [endHours, endMinutes] = form.endTime.split(":").map(Number);
      const startTotal = startHours * 60 + startMinutes;
      const endTotal = endHours * 60 + endMinutes;
      if (!Number.isFinite(startTotal) || !Number.isFinite(endTotal) || endTotal <= startTotal) return;
    }

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
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setEditingHabit(null);
    setForm(emptyForm);
    setIsExpanded(false);
  };

  const dailyGoal = getTimedDailyGoal(form, todayISO());

  if (!isExpanded) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add a habit</h2>
            <p className="mt-1 text-sm text-slate-600">Create a standard or timed habit.</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => setIsExpanded(true)}
            aria-label="Open add habit form"
          >
            <FaPlus />
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={handleSubmit}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{isEditing ? "Edit habit" : "Add a habit"}</h2>
          <p className="mt-1 text-sm text-slate-600">Set schedule and tracking options.</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
          onClick={handleCancel}
          aria-label="Close add habit form"
        >
          <FaXmark />
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <label className={labelClass}>
          Habit type
          <select name="type" value={form.type} onChange={handleChange} className={inputClass}>
            <option value="standard">Standard habit</option>
            <option value="timed">Timed recurring habit</option>
          </select>
        </label>

        <label className={labelClass}>
          Habit name
          <input
            type="text"
            name="name"
            list="habit-name-suggestions"
            value={form.name}
            onChange={handleNameChange}
            placeholder="Example: Morning walk"
            className={inputClass}
            required
          />
          <datalist id="habit-name-suggestions">
            {habitSuggestions.map((suggestion) => (
              <option key={suggestion.name} value={suggestion.name} />
            ))}
          </datalist>
        </label>

        <label className={labelClass}>
          Description
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Short note to keep you motivated"
            rows={3}
            className={inputClass}
          />
        </label>

        {form.type === "standard" ? (
          <label className={labelClass}>
            Frequency
            <select name="frequency" value={form.frequency} onChange={handleChange} className={inputClass}>
              <option>Daily</option>
              <option>Weekdays</option>
              <option>Weekends</option>
              <option>3x per week</option>
              <option>Custom</option>
            </select>
          </label>
        ) : (
          <>
            <label className={labelClass}>
              Repeat every (minutes)
              <input
                type="number"
                name="intervalMinutes"
                min="1"
                max="180"
                value={form.intervalMinutes}
                onChange={handleChange}
                className={inputClass}
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Start time
                <input type="time" name="startTime" value={form.startTime} onChange={handleChange} className={inputClass} />
              </label>
              <label className={labelClass}>
                End time
                <input type="time" name="endTime" value={form.endTime} onChange={handleChange} className={inputClass} />
              </label>
            </div>
            <fieldset className="rounded-xl border border-slate-200 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Skip days</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
                {weekdayOptions.map((day) => (
                  <label key={day.value} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.skipWeekdays.includes(day.value)}
                      onChange={() => handleSkipWeekdayChange(day.value)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />
                    <span>{day.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Daily goal from schedule: <span className="font-semibold text-slate-900">{dailyGoal}</span> reminders
            </div>
          </>
        )}

        <label className={labelClass}>
          Color
          <div className="flex flex-wrap gap-2">
            {colorPalette.map((color) => (
              <button
                key={color}
                type="button"
                className={`h-7 w-7 rounded-full border-2 ${form.color === color ? "border-slate-900" : "border-transparent"}`}
                style={{ backgroundColor: color }}
                onClick={() => setForm((prev) => ({ ...prev, color }))}
                aria-label={`Select ${color}`}
              />
            ))}
          </div>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          {isEditing ? "Save changes" : "Add habit"}
        </button>
        <button
          type="button"
          className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
