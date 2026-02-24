import { NavLink, Route, Routes } from "react-router-dom";
import { FaCalendarDays, FaChartLine, FaListCheck } from "react-icons/fa6";
import Dashboard from "./pages/Dashboard.jsx";
import Habits from "./pages/Habits.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";

const navClass = ({ isActive }) =>
  `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-cyan-50">
      <header className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-3 pt-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
            HT
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">HabitTracker</h1>
            <p className="text-sm text-slate-600">Build streaks. See progress.</p>
          </div>
        </div>
        <nav className="inline-flex w-full flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:w-auto">
          <NavLink to="/" end className={navClass}>
            <FaListCheck className="text-base" />
            Add Habits
          </NavLink>
          <NavLink to="/dashboard" className={navClass}>
            <FaChartLine className="text-base" />
            Dashboard
          </NavLink>
          <NavLink to="/calendar" className={navClass}>
            <FaCalendarDays className="text-base" />
            Calendar
          </NavLink>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Habits />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </main>
    </div>
  );
}
