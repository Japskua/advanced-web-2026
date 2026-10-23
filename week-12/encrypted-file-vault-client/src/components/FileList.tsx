import { useState } from "react";
import { DownloadIcon, Trash2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
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
      <div className="flex justify-center py-8">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  } else if (files.length === 0) {
    content = <p className="text-muted-foreground">No files yet.</p>;
  } else {
    content = (
      // `divide-y` draws a line between the list items.
      <ul className="divide-y">
        {files.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center gap-4 py-3">
            <div className="min-w-50 grow">
              <p className="wrap-anywhere">{file.originalFilename}</p>
              <p className="text-sm text-muted-foreground">
                {`${formatBytes(file.sizeBytes)} · ${new Date(file.createdAt).toLocaleString()}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => void handleDownload(file)}
                disabled={!key || busyId === file.id}
              >
                <DownloadIcon />
                Download
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDelete(file)}
                disabled={busyId === file.id}
              >
                <Trash2Icon />
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Your files</h2>
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4">
        {loadError && (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {content}
      </CardContent>
    </Card>
  );
}
