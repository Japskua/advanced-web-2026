import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('index.html must contain <div id="root"></div>');
}

// BrowserRouter keeps the UI in sync with the address bar, using the browser's
// History API. Everything inside it can use <Link>, useNavigate(), etc.
createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
