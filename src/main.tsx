import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "./i18n.tsx";
import { AppProvider } from "./ctx.tsx";
import { MascotProvider } from "./mascot/ctx.tsx";
import App from "./App.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><I18nProvider><AppProvider><MascotProvider><App /></MascotProvider></AppProvider></I18nProvider></StrictMode>,
);
