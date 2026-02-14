import { createContext, useContext, useMemo, useState } from "react";

const HabitContext = createContext(null);

const seedHabits = [
  {
    id: "h1",
    name: "Hydration",
    description: "Drink 8 glasses of water",
    frequency: "Daily",
    color: "#59a7ff",
    completions: {
      "2026-02-08": true,
      "2026-02-09": true,
    },
  },
  {
    id: "h2",
    name: "Read 20 minutes",
    description: "Nonfiction or fiction",
    frequency: "Daily",
    color: "#6dd3a9",
    completions: {
      "2026-02-07": true,
      "2026-02-09": true,
    },
  },
  {
    id: "h3",
    name: "Stretch",
    description: "10 minutes of mobility",
    frequency: "Weekdays",
    color: "#f0b35c",
    completions: {
      "2026-02-06": true,
      "2026-02-09": true,
    },
  },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export function HabitProvider({ children }) {
  const [habits, setHabits] = useState(seedHabits);
  const [editingHabit, setEditingHabit] = useState(null);

  const addHabit = (habit) => {
    setHabits((prev) => [
      ...prev,
      {
        ...habit,
        id: `h${Date.now()}`,
        completions: habit.completions ?? {},
      },
    ]);
  };

  const updateHabit = (updatedHabit) => {
    setHabits((prev) =>
      prev.map((habit) => (habit.id === updatedHabit.id ? updatedHabit : habit))
    );
  };

  const deleteHabit = (id) => {
    setHabits((prev) => prev.filter((habit) => habit.id !== id));
    if (editingHabit?.id === id) {
      setEditingHabit(null);
    }
  };

  const toggleCompletion = (habitId, date = todayISO()) => {
    setHabits((prev) =>
      prev.map((habit) => {
        if (habit.id !== habitId) return habit;
        const completions = { ...habit.completions };
        completions[date] = !completions[date];
        return { ...habit, completions };
      })
    );
  };

  const value = useMemo(
    () => ({
      habits,
      editingHabit,
      setEditingHabit,
      addHabit,
      updateHabit,
      deleteHabit,
      toggleCompletion,
    }),
    [habits, editingHabit]
  );

  return <HabitContext.Provider value={value}>{children}</HabitContext.Provider>;
}

export const useHabits = () => {
  const context = useContext(HabitContext);
  if (!context) {
    throw new Error("useHabits must be used within HabitProvider");
  }
  return context;
};
