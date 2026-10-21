import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
    // pt-0 and overflow-hidden: the cover starts at the top edge, clipped to
    // the card's rounded corners.
    <Card className="gap-4 overflow-hidden pt-0">
      {showCover ? (
        // h-55 = 55 × 0.25rem = 220px; object-contain shows the whole cover.
        <img
          src={coverUrl(book.coverId!)}
          alt={`Cover of ${book.title}`}
          loading="lazy"
          onError={() => setCoverFailed(true)}
          className="h-55 w-full bg-muted object-contain"
        />
      ) : (
        <div className="flex h-55 items-center justify-center bg-muted text-sm text-muted-foreground">No cover</div>
      )}

      <CardContent className="grow">
        <h3 className="mb-1 font-semibold">{book.title}</h3>
        <p className="text-sm text-muted-foreground">{book.authors.join(", ")}</p>
        <p className="mt-2 text-sm">
          First published: {book.firstPublishYear ?? "unknown"} · {book.editionCount} editions
        </p>
      </CardContent>

      <CardFooter>
        {/* Filled orange (the theme's secondary colour) while the book is a favourite. */}
        <Button variant={isFavorite ? "secondary" : "outline"} size="sm" onClick={() => onToggleFavorite(book)}>
          {isFavorite ? "★ Remove favourite" : "☆ Add favourite"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default memo(BookCard);
