import type { ReactNode } from "react";
import { Box, Container, Paper, Typography } from "@mui/material";

type Props = {
  title: string;
  subtitle?: string;
  maxWidth?: "sm" | "md";
  children: ReactNode;
};

// The centred card used by the login, register and onboarding pages.
export function AuthPageLayout({ title, subtitle, maxWidth = "sm", children }: Readonly<Props>) {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", bgcolor: "background.default", py: 4 }}>
      <Container maxWidth={maxWidth}>
        <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ mb: 3, textAlign: "center" }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {title}
            </Typography>
            {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
          </Box>
          {children}
        </Paper>
      </Container>
    </Box>
  );
}
