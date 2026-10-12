import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from "@mui/material";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { useEncryptionKey } from "../encryption/useEncryptionKey";
import { errorMessage } from "../format";

// Paste the saved key to unlock the vault for this browser session.
export function KeyManager() {
  const { key, fingerprint, loadKey, clearKey } = useEncryptionKey();

  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLoad() {
    setError("");
    setLoading(true);
    try {
      await loadKey(input);
      setInput(""); // do not keep the key on screen
    } catch (err) {
      setError(errorMessage(err, "Could not load the key."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
            <Typography variant="h6" component="h2">
              Encryption key
            </Typography>
            <Chip
              color={key ? "success" : "default"}
              label={key ? `Unlocked · ${fingerprint?.slice(0, 12)}…` : "Locked"}
              title={fingerprint ?? undefined}
            />
          </Box>

          {key ? (
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
                The key is in this tab's memory only. Reloading the page locks the vault again.
              </Typography>
              <Button variant="outlined" onClick={clearKey}>
                Lock
              </Button>
            </Stack>
          ) : (
            <>
              <Alert severity="info">
                Paste the key you saved during setup. It stays in this browser tab; the server never receives it.
              </Alert>
              <TextField
                label="Encryption key (Base64)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                multiline
                minRows={2}
                fullWidth
                slotProps={{ htmlInput: { spellCheck: false, autoComplete: "off" } }}
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Box>
                <Button
                  variant="contained"
                  startIcon={<VpnKeyIcon />}
                  onClick={handleLoad}
                  disabled={!input.trim() || loading}
                >
                  Unlock
                </Button>
              </Box>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
