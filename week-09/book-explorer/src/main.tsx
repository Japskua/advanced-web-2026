import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('index.html must contain <div id="root"></div>');
}

// No theme provider is needed: the shadcn/ui components are styled with
// Tailwind classes that read the theme's CSS variables from src/index.css,
// which index.html loads with a <link>.
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
