import { InputAdornment, TextField } from "@mui/material";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
};

// A controlled input; the parent owns the query.
export default function SearchBar({ query, onQueryChange }: Readonly<Props>) {
  return (
    <TextField
      label="Search books"
      placeholder="A title, an author or a keyword…"
      value={query}
      onChange={(e) => onQueryChange(e.target.value)}
      fullWidth
      autoFocus
      slotProps={{
        input: { startAdornment: <InputAdornment position="start">🔎</InputAdornment> },
      }}
    />
  );
}
