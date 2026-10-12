import { Button, Divider, List, ListItem, ListItemText, Paper, Stack, Typography } from "@mui/material";
import type { Book } from "../types";

type Props = {
  favorites: Book[];
  onRemove: (book: Book) => void;
};

export default function FavoritesPanel({ favorites, onRemove }: Readonly<Props>) {
  return (
    <Paper sx={{ p: 2, alignSelf: "start" }}>
      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          Favourites ({favorites.length})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Saved in this browser (localStorage).
        </Typography>

        <Divider />

        {favorites.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No favourites yet.
          </Typography>
        ) : (
          <List dense disablePadding>
            {favorites.map((book) => (
              <ListItem
                key={book.key}
                disableGutters
                secondaryAction={
                  <Button size="small" onClick={() => onRemove(book)}>
                    Remove
                  </Button>
                }
              >
                <ListItemText primary={book.title} secondary={book.authors.join(", ")} sx={{ pr: 8 }} />
              </ListItem>
            ))}
          </List>
        )}
      </Stack>
    </Paper>
  );
}
