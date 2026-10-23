import type { Book } from "../types";
import BookCard from "./BookCard";

type Props = {
  books: Book[];
  favoriteKeys: ReadonlySet<string>;
  onToggleFavorite: (book: Book) => void;
};

// A reusable, purely presentational component: give it books and it lays them
// out in a responsive grid (1 column on phones … 4 on wide screens). A prefix
// such as `xl:` applies a class from that breakpoint up: `xl:grid-cols-3` means
// 3 columns on screens at least 1280px wide.
export default function BookGrid({ books, favoriteKeys, onToggleFavorite }: Readonly<Props>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {books.map((book) => (
        <BookCard
          key={book.key}
          book={book}
          isFavorite={favoriteKeys.has(book.key)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
