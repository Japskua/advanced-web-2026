import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { EncryptionKeyProvider } from "./encryption/EncryptionKeyProvider";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('index.html must contain <div id="root"></div>');
}

// No theme provider is needed: the shadcn/ui components are styled with
// Tailwind classes that read the theme's CSS variables from src/index.css,
// which index.html loads with a <link>.
//
// The order of the providers matters: EncryptionKeyProvider reads the current
// user from the auth context, so it must be inside AuthProvider.
createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <EncryptionKeyProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </EncryptionKeyProvider>
    </AuthProvider>
  </StrictMode>,
);
