import { useState, type SubmitEvent } from "react";
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { MAX_FILE_BYTES } from "@shared/limits";
import type { FileDto } from "@shared/types";
import { uploadEncryptedFile } from "../api";
import { encryptFile } from "../crypto";
import { useEncryptionKey } from "../encryption/useEncryptionKey";
import { errorMessage, formatBytes } from "../format";

type Props = {
  onUploaded: (file: FileDto) => void;
};

export function FileUploadForm({ onUploaded }: Readonly<Props>) {
  const { key, fingerprint } = useEncryptionKey();

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const tooLarge = file !== null && file.size > MAX_FILE_BYTES;

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || !key || !fingerprint || tooLarge) return;

    const form = e.currentTarget; // read before the first await
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      // 1. Encrypt in the browser. Only ciphertext leaves this computer.
      const { ciphertext, iv } = await encryptFile(file, key);
      // 2. Upload ciphertext + what is needed to decrypt it later (the IV) +
      //    the key's fingerprint, which the server checks against the account.
      const uploaded = await uploadEncryptedFile({ ciphertext, original: file, iv, keyFingerprint: fingerprint });
      onUploaded(uploaded);
      setSuccess(`Encrypted and uploaded ${uploaded.originalFilename}.`);
      setFile(null);
      form.reset();
    } catch (err) {
      setError(errorMessage(err, "Upload failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6" component="h2">
            Upload a file
          </Typography>

          {!key && <Alert severity="warning">Unlock the vault with your key to upload files.</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          {tooLarge && <Alert severity="error">Files may be at most {formatBytes(MAX_FILE_BYTES)}.</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
              <Button variant="outlined" component="label" disabled={!key || busy}>
                {file ? `${file.name} (${formatBytes(file.size)})` : "Choose file"}
                <input hidden type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<UploadFileIcon />}
                disabled={!file || !key || busy || tooLarge}
              >
                {busy ? "Encrypting…" : "Encrypt and upload"}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
