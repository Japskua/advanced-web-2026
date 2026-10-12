import { useEffect, useState } from "react";
import { Alert, Box, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import type { NotificationDto } from "@shared/types";
import { fetchNotifications } from "../api";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    // No 401 handling here: api.ts clears an expired token, and ProtectedRoute
    // then redirects to the login page by itself.
    fetchNotifications(controller.signal)
      .then(setNotifications)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1">
        Notifications
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {!error && notifications.length === 0 && (
        <Typography color="text.secondary">No notifications yet.</Typography>
      )}

      {notifications.map((notification) => (
        <Card key={notification.id}>
          <CardContent>
            <Typography variant="h6" component="h2">
              {notification.title}
            </Typography>
            {/* pre-line keeps the line breaks the admin typed. */}
            <Typography variant="body1" sx={{ mt: 1, whiteSpace: "pre-line" }}>
              {notification.content}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
              {notification.author.email} · {new Date(notification.createdAt).toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
