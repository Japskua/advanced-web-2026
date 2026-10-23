import { useState } from "react";
import { KeyRoundIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Encryption key</h2>
        </CardTitle>
        {/* CardAction puts the badge at the right end of the header. */}
        <CardAction>
          <Badge
            variant={key ? "default" : "outline"}
            className={key ? "bg-green-600 text-white" : undefined}
            title={fingerprint ?? undefined}
          >
            {key ? `Unlocked · ${fingerprint?.slice(0, 12)}…` : "Locked"}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-4">
        {key ? (
          <div className="flex items-center gap-4">
            <p className="grow text-muted-foreground">
              The key is in this tab's memory only. Reloading the page locks the vault again.
            </p>
            <Button variant="outline" onClick={clearKey}>
              Lock
            </Button>
          </div>
        ) : (
          <>
            <Alert>
              <AlertDescription>
                Paste the key you saved during setup. It stays in this browser tab; the server never receives it.
              </AlertDescription>
            </Alert>
            <div className="grid gap-2">
              <Label htmlFor="encryption-key">Encryption key (Base64)</Label>
              <Textarea
                id="encryption-key"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div>
              <Button onClick={handleLoad} disabled={!input.trim() || loading}>
                <KeyRoundIcon />
                Unlock
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
