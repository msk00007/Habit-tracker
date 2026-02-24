import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import { HabitProvider } from "./state/HabitContext.jsx";
import "./index.css";

if (!import.meta.env.VITE_ONESIGNAL_APP_ID) {
  registerSW({ immediate: true });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <HabitProvider>
        <App />
      </HabitProvider>
    </BrowserRouter>
  </React.StrictMode>
);
