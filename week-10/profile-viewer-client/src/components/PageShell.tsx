import type { ReactNode } from "react";
import { Box, Container, Paper, Stack } from "@mui/material";
import LanguageSwitcher from "./LanguageSwitcher";

// The frame shared by both pages: the language switcher and a centred card.
export default function PageShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={3}>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <LanguageSwitcher />
        </Box>
        <Paper sx={{ p: 4 }}>{children}</Paper>
      </Stack>
    </Container>
  );
}
