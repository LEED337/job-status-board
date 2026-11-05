import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { restoreStaticRedirect } from "./lib/redirect.ts";
import { ensureTheme } from "./lib/theme.ts";
import "./index.css";

ensureTheme();
restoreStaticRedirect();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
