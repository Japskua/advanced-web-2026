import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Book } from "../types";

type Props = {
  favorites: Book[];
  onRemove: (book: Book) => void;
};

export default function FavoritesPanel({ favorites, onRemove }: Readonly<Props>) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Favourites ({favorites.length})</h2>
        </CardTitle>
        <CardDescription>Saved in this browser (localStorage).</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-3">
        <Separator />

        {favorites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No favourites yet.</p>
        ) : (
          <ul className="grid gap-3">
            {favorites.map((book) => (
              <li key={book.key} className="flex items-start justify-between gap-2">
                {/* min-w-0 lets a long title wrap instead of pushing the button out. */}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{book.title}</p>
                  <p className="text-sm text-muted-foreground">{book.authors.join(", ")}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onRemove(book)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
