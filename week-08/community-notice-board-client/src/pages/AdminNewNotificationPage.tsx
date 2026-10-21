import { useState, type SubmitEvent } from "react";
import { Link } from "react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createNotification } from "../api";

export default function AdminNewNotificationPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const created = await createNotification({ title, content });
      setTitle("");
      setContent("");
      setSuccess(`Published "${created.title}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create the notification");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl">New notification</h1>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="content">Content</Label>
            <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-32" required />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <AlertDescription className="flex w-full items-center justify-between gap-2">
                {success}
                <Button variant="outline" size="sm" asChild>
                  <Link to="/notifications">View</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? "Publishing…" : "Publish"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
