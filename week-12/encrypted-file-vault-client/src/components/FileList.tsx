import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import type { FileDto } from "@shared/types";
import { deleteFile, downloadEncryptedFile } from "../api";
import { decryptBytes } from "../crypto";
import { useEncryptionKey } from "../encryption/useEncryptionKey";
import { errorMessage, formatBytes, saveToDisk } from "../format";

type Props = {
  files: FileDto[];
  loading: boolean;
  loadError: string;
  onDeleted: (fileId: string) => void;
};

export function FileList({ files, loading, loadError, onDeleted }: Readonly<Props>) {
  const { key } = useEncryptionKey();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleDownload(file: FileDto) {
    if (!key) return;
    setBusyId(file.id);
    setError("");
    try {
      // Download ciphertext, decrypt it here with the key and the stored IV,
      // and hand the plaintext to the browser as a file.
      const ciphertext = await downloadEncryptedFile(file.id);
      const plaintext = await decryptBytes(ciphertext, key, file.encryptionIv);
      saveToDisk(plaintext, file.originalFilename, file.contentType);
    } catch (err) {
      setError(errorMessage(err, "Download failed."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(file: FileDto) {
    if (!globalThis.confirm(`Delete "${file.originalFilename}" permanently?`)) return;
    setBusyId(file.id);
    setError("");
    try {
      await deleteFile(file.id);
      onDeleted(file.id);
    } catch (err) {
      setError(errorMessage(err, "Delete failed."));
    } finally {
      setBusyId(null);
    }
  }

  let content;
  if (loading) {
    content = (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  } else if (files.length === 0) {
    content = <Typography color="text.secondary">No files yet.</Typography>;
  } else {
    content = (
      <List disablePadding>
        {files.map((file) => (
          <ListItem key={file.id} divider sx={{ gap: 2, flexWrap: "wrap" }}>
            <ListItemText
              primary={file.originalFilename}
              secondary={`${formatBytes(file.sizeBytes)} · ${new Date(file.createdAt).toLocaleString()}`}
              sx={{ minWidth: 200 }}
            />
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => void handleDownload(file)}
                disabled={!key || busyId === file.id}
              >
                Download
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => void handleDelete(file)}
                disabled={busyId === file.id}
              >
                Delete
              </Button>
            </Stack>
          </ListItem>
        ))}
      </List>
    );
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6" component="h2">
            Your files
          </Typography>
          {loadError && <Alert severity="error">{loadError}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {content}
        </Stack>
      </CardContent>
    </Card>
  );
}
