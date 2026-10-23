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
import { CopyIcon, KeyIcon, SaveIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div className="grid gap-6">
        {/* shadcn/ui's Alert has no warning style; amber Tailwind colours in className make one. */}
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertDescription className="text-amber-900">
            The server never receives this key. If you lose it, nobody can decrypt your files, not even the administrators.
          </AlertDescription>
        </Alert>

        <ol className="list-decimal pl-6 text-muted-foreground">
          <li>Generate a key in this browser.</li>
          <li>Save it somewhere safe: a password manager is ideal.</li>
          <li>Only a fingerprint (SHA-256 hash) of the key is sent to the server, to detect a wrong key later.</li>
        </ol>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {/* The extra <div> keeps the button its natural width instead of stretching across the grid. */}
        <div>
          <Button onClick={() => void handleGenerate()} disabled={busy}>
            <KeyIcon />
            {generated ? "Generate a different key" : "Generate encryption key"}
          </Button>
        </div>

        {generated && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="generated-key">Your encryption key</Label>
              <Input id="generated-key" value={generated.base64} readOnly className="font-mono" />
            </div>
            {/* A column on phones, a row from the `sm` breakpoint (640px) up. */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button variant="outline" onClick={() => void handleCopy()}>
                <CopyIcon />
                Copy
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <SaveIcon />
                Download as a file
              </Button>
            </div>
            <p className="text-sm break-all text-muted-foreground">Fingerprint: {generated.fingerprint}</p>
            {/* Radix UI's Checkbox is a <button role="checkbox">; onCheckedChange gives true, false or "indeterminate". */}
            <div className="flex items-center gap-2">
              <Checkbox id="key-saved" checked={saved} onCheckedChange={(checked) => setSaved(checked === true)} />
              <Label htmlFor="key-saved">I have saved the key somewhere safe.</Label>
            </div>
            <div className="flex justify-end">
              <Button size="lg" onClick={() => void handleContinue()} disabled={!saved || busy}>
                Continue to my vault
              </Button>
            </div>
          </>
        )}
      </div>
    </AuthPageLayout>
  );
}
