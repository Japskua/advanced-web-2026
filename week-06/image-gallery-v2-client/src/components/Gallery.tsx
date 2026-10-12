import type { UploadRecord } from "@shared/types";
import { imageUrl } from "../api";
import { formatBytes, formatDate } from "../format";

type Props = {
  uploads: UploadRecord[];
  loading: boolean;
  deletingId: string | null;
  onDelete: (id: string) => void;
};

export default function Gallery({ uploads, loading, deletingId, onDelete }: Readonly<Props>) {
  if (loading) {
    return <div className="muted">Loading gallery…</div>;
  }

  if (uploads.length === 0) {
    return <div className="muted">No uploads yet. Upload an image above.</div>;
  }

  return (
    <div className="gallery">
      {uploads.map((upload) => {
        const isDeleting = deletingId === upload.id;

        return (
          <figure key={upload.id} className="imgCard">
            <img src={imageUrl(upload)} alt={upload.originalName} loading="lazy" />
            <figcaption className="imgMeta">
              <div className="imgName" title={upload.originalName}>
                {upload.originalName}
              </div>
              <div>
                {formatBytes(upload.size)} · {formatDate(upload.uploadedAt)}
              </div>
              <button
                type="button"
                className="btn btnDanger"
                onClick={() => onDelete(upload.id)}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
