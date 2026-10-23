import { useRef, useState, type SubmitEvent } from "react";
import { FileUpIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  // The browser's own file input is hidden; the "Choose file" button opens it.
  const fileInput = useRef<HTMLInputElement>(null);

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
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Upload a file</h2>
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4">
        {!key && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900">
            <AlertDescription className="text-amber-900">Unlock the vault with your key to upload files.</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        {tooLarge && (
          <Alert variant="destructive">
            <AlertDescription>Files may be at most {formatBytes(MAX_FILE_BYTES)}.</AlertDescription>
          </Alert>
        )}

        {/* A column on phones, a row from the `sm` breakpoint (640px) up. */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* A long file name wraps instead of overflowing the card. */}
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-9 whitespace-normal wrap-anywhere"
            onClick={() => fileInput.current?.click()}
            disabled={!key || busy}
          >
            {file ? `${file.name} (${formatBytes(file.size)})` : "Choose file"}
          </Button>
          <input ref={fileInput} hidden type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button type="submit" disabled={!file || !key || busy || tooLarge}>
            <FileUpIcon />
            {busy ? "Encrypting…" : "Encrypt and upload"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
