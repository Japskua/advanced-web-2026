/**
 * First login: create the encryption key.
 *
 * 1. The browser generates a random 256-bit AES key.
 * 2. The user saves it (copy, or download as a text file).
 * 3. Only the key's SHA-256 fingerprint is sent to the server.
 *
 * There is no "forgot my key": the server cannot recover what it never had.
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { Alert, Box, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import KeyIcon from "@mui/icons-material/Key";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import { registerKeyFingerprint } from "../api";
import { useAuth } from "../auth/useAuth";
import { AuthPageLayout } from "../components/AuthPageLayout";
import { exportKey, fingerprintOf, generateKey } from "../crypto";
import { useEncryptionKey } from "../encryption/useEncryptionKey";
import { errorMessage, saveToDisk } from "../format";

interface GeneratedKey {
  key: CryptoKey;
  base64: string;
  fingerprint: string;
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { activateGeneratedKey } = useEncryptionKey();

  const [generated, setGenerated] = useState<GeneratedKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleGenerate() {
    setError("");
    const key = await generateKey();
    setGenerated({ key, base64: await exportKey(key), fingerprint: await fingerprintOf(key) });
    setSaved(false);
  }

  async function handleCopy() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.base64);
      setMessage("Key copied to the clipboard.");
    } catch {
      setError("Copying failed. Select the key and copy it manually.");
    }
  }

  function handleDownload() {
    if (!generated) return;
    saveToDisk(`${generated.base64}\n`, "vault-encryption-key.txt", "text/plain");
    setMessage("Key saved as vault-encryption-key.txt. Keep it somewhere safe.");
  }

  async function handleContinue() {
    if (!generated) return;
    setError("");
    setBusy(true);
    try {
      const user = await registerKeyFingerprint(generated.fingerprint);
      setUser(user);
      // The key is already in memory: unlock the vault right away.
      activateGeneratedKey(generated.key, generated.fingerprint);
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Could not finish the setup."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageLayout
      maxWidth="md"
      title="Set up your encryption key"
      subtitle="Files are encrypted in your browser before they are uploaded."
    >
      <Stack spacing={3}>
        <Alert severity="warning">
          The server never receives this key. If you lose it, nobody can decrypt your files, not even the administrators.
        </Alert>

        <Box component="ol" sx={{ m: 0, pl: 3, color: "text.secondary" }}>
          <li>Generate a key in this browser.</li>
          <li>Save it somewhere safe: a password manager is ideal.</li>
          <li>Only a fingerprint (SHA-256 hash) of the key is sent to the server, to detect a wrong key later.</li>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="success">{message}</Alert>}

        <Box>
          <Button variant="contained" startIcon={<KeyIcon />} onClick={() => void handleGenerate()} disabled={busy}>
            {generated ? "Generate a different key" : "Generate encryption key"}
          </Button>
        </Box>

        {generated && (
          <>
            <TextField
              label="Your encryption key"
              value={generated.base64}
              fullWidth
              slotProps={{ input: { readOnly: true, sx: { fontFamily: "monospace" } } }}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => void handleCopy()}>
                Copy
              </Button>
              <Button variant="outlined" startIcon={<SaveAltIcon />} onClick={handleDownload}>
                Download as a file
              </Button>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
              Fingerprint: {generated.fingerprint}
            </Typography>
            <FormControlLabel
              control={<Checkbox checked={saved} onChange={(e) => setSaved(e.target.checked)} />}
              label="I have saved the key somewhere safe."
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="contained" size="large" onClick={() => void handleContinue()} disabled={!saved || busy}>
                Continue to my vault
              </Button>
            </Box>
          </>
        )}
      </Stack>
    </AuthPageLayout>
  );
}
