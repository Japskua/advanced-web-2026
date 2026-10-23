import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FileDto } from "@shared/types";
import { fetchFiles } from "../api";
import { useAuth } from "../auth/useAuth";
import { FileList } from "../components/FileList";
import { FileUploadForm } from "../components/FileUploadForm";
import { KeyManager } from "../components/KeyManager";
import { errorMessage } from "../format";

// Ghost buttons hover with a light grey by default; on the blue header a
// translucent white looks better. Tailwind classes in `className` override the
// component's own.
const headerButton = "hover:bg-primary-foreground/15 hover:text-primary-foreground";

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
    <div className="min-h-screen">
      <header className="bg-primary text-primary-foreground shadow">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <span className="grow text-lg font-semibold">Encrypted File Vault</span>
          <span className="text-sm">{email}</span>
          <Button variant="ghost" className={headerButton} onClick={logout}>
            Log out
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
        <KeyManager />
        <FileUploadForm onUploaded={(file) => setFiles((prev) => [file, ...prev])} />
        <FileList
          files={files}
          loading={loading}
          loadError={loadError}
          onDeleted={(id) => setFiles((prev) => prev.filter((file) => file.id !== id))}
        />
      </main>
    </div>
  );
}
