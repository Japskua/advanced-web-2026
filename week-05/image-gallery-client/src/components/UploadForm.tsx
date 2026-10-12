import { useState, type ChangeEvent, type SubmitEvent } from "react";
import { MAX_UPLOAD_BYTES, ALLOWED_IMAGE_TYPES, isAllowedImageType } from "@shared/upload-rules";
import { formatBytes } from "../format";

type Props = {
  uploading: boolean;
  onUpload: (file: File) => Promise<boolean>;
};

// The same rules the API enforces, imported from shared/upload-rules.ts.
// Checking here gives instant feedback; the API still checks, because the
// client can be bypassed.
function validate(file: File): string | null {
  if (!isAllowedImageType(file.type)) return "Only PNG, JPEG, WebP and GIF images are supported.";
  if (file.size > MAX_UPLOAD_BYTES) return `The file is larger than ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  return null;
}

export default function UploadForm({ uploading, onUpload }: Readonly<Props>) {
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setValidationError(selected ? (validate(selected) ?? "") : "");
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || validationError) return;

    // Keep a reference to the form now: after an `await`, the event object's
    // currentTarget has already been reset to null by React.
    const form = e.currentTarget;

    const succeeded = await onUpload(file);
    if (succeeded) {
      setFile(null);
      form.reset(); // a file input cannot be controlled by state; reset the form instead
    }
  }

  return (
    <form onSubmit={handleSubmit} className="uploadForm">
      <input
        type="file"
        accept={Object.keys(ALLOWED_IMAGE_TYPES).join(",")}
        onChange={handleFileChange}
        aria-label="Image file"
      />

      {file && !validationError && (
        <span className="muted">
          {file.name} · {formatBytes(file.size)}
        </span>
      )}

      <button type="submit" className="btn" disabled={!file || !!validationError || uploading}>
        {uploading ? "Uploading…" : "Upload"}
      </button>

      {validationError && <div className="fieldError">{validationError}</div>}
    </form>
  );
}
