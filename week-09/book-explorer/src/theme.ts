// Material UI's theme: one object that sets colours, typography, spacing and
// component defaults for the whole application. Every MUI component reads it,
// so changing `primary.main` here recolours every button, link and app bar.
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2e5e4e" },
    secondary: { main: "#b5651d" },
    background: { default: "#f5f6f8" },
  },
  typography: {
    // The operating system's UI font, so no web font has to be downloaded.
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  },
  shape: { borderRadius: 10 },
});
