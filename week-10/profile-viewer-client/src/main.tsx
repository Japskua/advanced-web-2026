import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { CssBaseline, ThemeProvider } from "@mui/material";
import App from "./App";
import { theme } from "./theme";
// Imported for its side effect: initialises i18next before the first render.
import "./i18n";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('index.html must contain <div id="root"></div>');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
