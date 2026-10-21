import { useEffect, useState } from "react";
import type { NotificationDto } from "@shared/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
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
      <div className="flex justify-center py-12">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-semibold">Notifications</h1>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!error && notifications.length === 0 && <p className="text-muted-foreground">No notifications yet.</p>}

      {notifications.map((notification) => (
        <Card key={notification.id}>
          <CardHeader>
            <CardTitle>
              <h2 className="text-lg">{notification.title}</h2>
            </CardTitle>
          </CardHeader>
          {/* whitespace-pre-line keeps the line breaks the admin typed. */}
          <CardContent className="whitespace-pre-line">{notification.content}</CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            {notification.author.email} · {new Date(notification.createdAt).toLocaleString()}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
