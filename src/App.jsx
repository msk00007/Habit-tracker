import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Habits from "./pages/Habits.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";

const navClass = ({ isActive }) => (isActive ? "nav-link active" : "nav-link");

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">HT</span>
          <div>
            <h1>HabitTracker</h1>
            <p>Build streaks. See progress.</p>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={navClass}>
            Dashboard
          </NavLink>
          <NavLink to="/habits" className={navClass}>
            Habits
          </NavLink>
          <NavLink to="/calendar" className={navClass}>
            Calendar
          </NavLink>
        </nav>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </main>
    </div>
  );
}
