import { useEffect, useState } from "react";
import type { UploadRecord } from "@shared/types";
import { fetchUploads, uploadImage } from "./api";
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

  const [statusMessage, setStatusMessage] = useState("");
  const [statusVariant, setStatusVariant] = useState<StatusVariant>("info");

  function showStatus(variant: StatusVariant, message: string) {
    setStatusVariant(variant);
    setStatusMessage(message);
  }

  // Load the gallery once, on mount (the pattern from week 4).
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

  // Returns whether the upload succeeded, so the form knows whether to reset.
  async function handleUpload(file: File): Promise<boolean> {
    setUploading(true);
    showStatus("info", "Uploading…");

    try {
      const record = await uploadImage(file);
      // The server responds with the new record; add it to the front of the list
      // instead of downloading the whole list again.
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

  return (
    <div className="container">
      <header className="header">
        <h1>Image Gallery</h1>
      </header>

      <section className="card">
        <h2>Upload</h2>
        <UploadForm uploading={uploading} onUpload={handleUpload} />
        <StatusBanner message={statusMessage} variant={statusVariant} />
      </section>

      <section className="card">
        <h2>Gallery</h2>
        <Gallery uploads={uploads} loading={loading} />
      </section>
    </div>
  );
}
