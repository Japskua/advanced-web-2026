// The entry point: index.html loads this file, and this file mounts the React
// application into the <div id="root"> element.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('index.html must contain <div id="root"></div>');
}

// StrictMode adds extra development-time checks. One visible effect: some
// functions run twice in development to expose side effects. Production builds
// are not affected.
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
