import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
};

// A controlled input; the parent owns the query.
export default function SearchBar({ query, onQueryChange }: Readonly<Props>) {
  return (
    <div className="grid gap-2">
      {/* htmlFor/id tie the label to the input: a click on it focuses the field. */}
      <Label htmlFor="search">Search books</Label>
      {/* The icon is laid over the input (absolute, inside a relative box); pl-9 leaves room for it. */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="search"
          placeholder="A title, an author or a keyword…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          autoFocus
          className="pl-9"
        />
      </div>
    </div>
  );
}
