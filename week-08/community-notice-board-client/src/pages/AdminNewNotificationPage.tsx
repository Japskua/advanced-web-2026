import { useState, type SubmitEvent } from "react";
import { Link as RouterLink } from "react-router";
import { Alert, Box, Button, Paper, TextField, Typography } from "@mui/material";
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
    <Paper sx={{ p: 4 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        New notification
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ display: "grid", gap: 2, mt: 2 }}>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 120 } }}
          required
          fullWidth
        />
        <TextField
          label="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          multiline
          minRows={4}
          required
          fullWidth
        />

        {error && <Alert severity="error">{error}</Alert>}
        {success && (
          <Alert
            severity="success"
            action={
              <Button color="inherit" size="small" component={RouterLink} to="/notifications">
                View
              </Button>
            }
          >
            {success}
          </Alert>
        )}

        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? "Publishing…" : "Publish"}
        </Button>
      </Box>
    </Paper>
  );
}
