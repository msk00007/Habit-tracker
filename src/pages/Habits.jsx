import HabitForm from "../components/HabitForm.jsx";
import HabitList from "../components/HabitList.jsx";

export default function Habits() {
  return (
    <section className="habits-page">
      <HabitForm />
      <HabitList />
    </section>
  );
}
