import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('index.html must contain <div id="root"></div>');
}

// In development, StrictMode mounts every component, unmounts it and mounts it
// again. Effects therefore run twice, and their cleanup runs in between. That
// is deliberate: an effect whose cleanup is wrong shows its bug immediately.
// Watch the Network tab: the first requests on page load are cancelled by the
// cleanup function in App's useEffect.
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
