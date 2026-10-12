import type { UploadRecord } from "@shared/types";
import { imageUrl } from "../api";
import { formatBytes, formatDate } from "../format";

type Props = {
  uploads: UploadRecord[];
  loading: boolean;
};

export default function Gallery({ uploads, loading }: Readonly<Props>) {
  if (loading) {
    return <div className="muted">Loading gallery…</div>;
  }

  if (uploads.length === 0) {
    return <div className="muted">No uploads yet. Upload an image above.</div>;
  }

  return (
    <div className="gallery">
      {uploads.map((upload) => (
        <figure key={upload.id} className="imgCard">
          {/* loading="lazy": the browser fetches images only when they scroll into view. */}
          <img src={imageUrl(upload)} alt={upload.originalName} loading="lazy" />
          <figcaption className="imgMeta">
            <div className="imgName" title={upload.originalName}>
              {upload.originalName}
            </div>
            <div>
              {formatBytes(upload.size)} · {formatDate(upload.uploadedAt)}
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
