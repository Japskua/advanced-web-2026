import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { CssBaseline, ThemeProvider } from "@mui/material";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { EncryptionKeyProvider } from "./encryption/EncryptionKeyProvider";
import { theme } from "./theme";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('index.html must contain <div id="root"></div>');
}

// The order of the providers matters: EncryptionKeyProvider reads the current
// user from the auth context, so it must be inside AuthProvider.
createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <EncryptionKeyProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </EncryptionKeyProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
