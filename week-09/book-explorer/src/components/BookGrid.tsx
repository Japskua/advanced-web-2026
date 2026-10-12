import { Grid } from "@mui/material";
import type { Book } from "../types";
import BookCard from "./BookCard";

type Props = {
  books: Book[];
  favoriteKeys: ReadonlySet<string>;
  onToggleFavorite: (book: Book) => void;
};

// A reusable, purely presentational component: give it books and it lays them
// out in a responsive grid (1 column on phones … 4 on wide screens).
export default function BookGrid({ books, favoriteKeys, onToggleFavorite }: Readonly<Props>) {
  return (
    <Grid container spacing={2}>
      {books.map((book) => (
        <Grid key={book.key} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
          <BookCard book={book} isFavorite={favoriteKeys.has(book.key)} onToggleFavorite={onToggleFavorite} />
        </Grid>
      ))}
    </Grid>
  );
}
