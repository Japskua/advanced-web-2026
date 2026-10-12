import { FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch } from "@mui/material";
import type { SortOrder } from "../types";

type Props = {
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  onlyWithCover: boolean;
  onOnlyWithCoverChange: (value: boolean) => void;
};

const SORT_LABELS: Record<SortOrder, string> = {
  relevance: "Relevance",
  new: "Newest first",
  old: "Oldest first",
};

export default function ControlsBar({ sort, onSortChange, onlyWithCover, onOnlyWithCoverChange }: Readonly<Props>) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
      <FormControl sx={{ minWidth: 200 }} size="small">
        <InputLabel id="sort-label">Sort by</InputLabel>
        <Select
          labelId="sort-label"
          label="Sort by"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOrder)}
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControlLabel
        control={<Switch checked={onlyWithCover} onChange={(e) => onOnlyWithCoverChange(e.target.checked)} />}
        label="Only books with a cover"
      />
    </Stack>
  );
}
