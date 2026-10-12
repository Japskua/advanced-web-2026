import { memo, useState } from "react";
import { Button, Card, CardActions, CardContent, CardMedia, Stack, Typography } from "@mui/material";
import { coverUrl } from "../api";
import type { Book } from "../types";

type Props = {
  book: Book;
  isFavorite: boolean;
  onToggleFavorite: (book: Book) => void;
};

/**
 * One book. Wrapped in memo(): React skips re-rendering a memoised component
 * when all of its props are equal (===) to last time.
 *
 * With 24 cards on screen, toggling one favourite would otherwise re-render all
 * 24. With memo, only the card whose `isFavorite` changed re-renders, *provided*
 * the parent passes the same onToggleFavorite function every time. That is why
 * App wraps it in useCallback. memo and useCallback only help together.
 *
 * Measure before optimising: React DevTools → Profiler → "Highlight updates"
 * shows which components re-render.
 */
function BookCard({ book, isFavorite, onToggleFavorite }: Readonly<Props>) {
  // Local UI state: hide the image if the cover fails to load.
  const [coverFailed, setCoverFailed] = useState(false);
  const showCover = book.coverId !== undefined && !coverFailed;

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {showCover ? (
        <CardMedia
          component="img"
          height="220"
          image={coverUrl(book.coverId!)}
          alt={`Cover of ${book.title}`}
          loading="lazy"
          onError={() => setCoverFailed(true)}
          sx={{ objectFit: "contain", bgcolor: "grey.100" }}
        />
      ) : (
        <Stack sx={{ height: 220, alignItems: "center", justifyContent: "center", bgcolor: "grey.100" }}>
          <Typography variant="body2" color="text.secondary">
            No cover
          </Typography>
        </Stack>
      )}

      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }} gutterBottom>
          {book.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {book.authors.join(", ")}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          First published: {book.firstPublishYear ?? "unknown"} · {book.editionCount} editions
        </Typography>
      </CardContent>

      <CardActions>
        <Button onClick={() => onToggleFavorite(book)} color={isFavorite ? "secondary" : "primary"}>
          {isFavorite ? "★ Remove favourite" : "☆ Add favourite"}
        </Button>
      </CardActions>
    </Card>
  );
}

export default memo(BookCard);
