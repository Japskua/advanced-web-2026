import { useEffect, useState } from "react";
import type { UploadRecord } from "@shared/types";
import { deleteImage, fetchUploads, uploadImage } from "./api";
import Gallery from "./components/Gallery";
import StatusBanner, { type StatusVariant } from "./components/StatusBanner";
import UploadForm from "./components/UploadForm";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function App() {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  // The id of the image being deleted, so only its button shows "Deleting…".
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState("");
  const [statusVariant, setStatusVariant] = useState<StatusVariant>("info");

  function showStatus(variant: StatusVariant, message: string) {
    setStatusVariant(variant);
    setStatusMessage(message);
  }

  useEffect(() => {
    const controller = new AbortController();

    fetchUploads(controller.signal)
      .then(setUploads)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) showStatus("error", errorMessage(e, "Failed to load the gallery"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  async function handleUpload(file: File): Promise<boolean> {
    setUploading(true);
    showStatus("info", "Uploading…");

    try {
      const record = await uploadImage(file);
      setUploads((prev) => [record, ...prev]);
      showStatus("success", `Uploaded ${record.originalName}.`);
      return true;
    } catch (e) {
      showStatus("error", errorMessage(e, "Upload failed"));
      return false;
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    showStatus("info", "Deleting image…");

    try {
      const deleted = await deleteImage(id);
      // Remove it from the list only after the server confirmed the delete.
      setUploads((prev) => prev.filter((upload) => upload.id !== id));
      showStatus("success", `Deleted ${deleted.originalName}.`);
    } catch (e) {
      showStatus("error", errorMessage(e, "Delete failed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Image Gallery v2</h1>
      </header>

      <section className="card">
        <h2>Upload</h2>
        <UploadForm uploading={uploading} onUpload={handleUpload} />
        <StatusBanner message={statusMessage} variant={statusVariant} />
      </section>

      <section className="card">
        <h2>Gallery</h2>
        <Gallery uploads={uploads} loading={loading} deletingId={deletingId} onDelete={handleDelete} />
      </section>
    </div>
  );
}
