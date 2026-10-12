import { useEffect, useState } from "react";
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";
import type { FileDto } from "@shared/types";
import { fetchFiles } from "../api";
import { useAuth } from "../auth/useAuth";
import { FileList } from "../components/FileList";
import { FileUploadForm } from "../components/FileUploadForm";
import { KeyManager } from "../components/KeyManager";
import { errorMessage } from "../format";

export function DashboardPage() {
  const { state, logout } = useAuth();
  const email = state.status === "authenticated" ? state.user.email : "";

  // The file list lives here, so the upload form and the list share it:
  // an upload adds to it, a delete removes from it, without reloading.
  const [files, setFiles] = useState<FileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchFiles(controller.signal)
      .then(setFiles)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(err, "Could not load your files."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static">
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Encrypted File Vault
          </Typography>
          <Typography variant="body2">{email}</Typography>
          <Button color="inherit" onClick={logout}>
            Log out
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <KeyManager />
          <FileUploadForm onUploaded={(file) => setFiles((prev) => [file, ...prev])} />
          <FileList
            files={files}
            loading={loading}
            loadError={loadError}
            onDeleted={(id) => setFiles((prev) => prev.filter((file) => file.id !== id))}
          />
        </Stack>
      </Container>
    </Box>
  );
}
