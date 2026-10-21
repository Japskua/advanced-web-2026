import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  count: number; // how many pages there are
  page: number; // the current page, 1-based
  onPageChange: (page: number) => void;
};

type PagerItem = number | "start-gap" | "end-gap";

/**
 * Which buttons the pager shows. Up to 7 pages: all of them. More: the first
 * and the last page, the current page with one neighbour on each side, and a
 * gap ("…") for the pages in between. That is always 7 items, so the buttons
 * do not jump around while the user pages.
 */
function pagerItems(page: number, count: number): PagerItem[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);

  // The current page and its two neighbours, moved inwards near the ends.
  // With 50 pages: page 1 → 1 2 3 4 5 … 50, page 20 → 1 … 19 20 21 … 50,
  // page 50 → 1 … 46 47 48 49 50.
  const start = Math.min(Math.max(page - 1, 3), count - 4);
  return [
    1,
    start === 3 ? 2 : "start-gap",
    start,
    start + 1,
    start + 2,
    start + 2 === count - 2 ? count - 1 : "end-gap",
    count,
  ];
}

/**
 * A pager made of shadcn/ui Buttons: previous, the page numbers, next.
 *
 * Purely presentational, like the other components: it shows `page` and
 * reports a click with onPageChange(n); App owns the state. For screen
 * readers the buttons are labelled ("Go to page 3") and the current page is
 * marked with aria-current="page".
 */
export default function Pager({ count, page, onPageChange }: Readonly<Props>) {
  return (
    <nav aria-label="pagination navigation" className="flex flex-wrap items-center justify-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Go to previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon />
      </Button>

      {pagerItems(page, count).map((item) =>
        typeof item === "number" ? (
          <Button
            key={item}
            variant={item === page ? "default" : "ghost"}
            size="icon-sm"
            aria-label={`Go to page ${item}`}
            aria-current={item === page ? "page" : undefined}
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        ) : (
          <span key={item} aria-hidden="true" className="px-1 text-muted-foreground">
            …
          </span>
        ),
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Go to next page"
        disabled={page >= count}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRightIcon />
      </Button>
    </nav>
  );
}
