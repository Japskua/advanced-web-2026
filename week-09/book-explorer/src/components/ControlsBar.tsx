import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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

// Stacked on phones, side by side from the sm breakpoint (640px) up.
export default function ControlsBar({ sort, onSortChange, onlyWithCover, onOnlyWithCoverChange }: Readonly<Props>) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex items-center gap-2">
        <Label htmlFor="sort">Sort by</Label>
        {/*
          shadcn/ui's Select (Radix UI underneath) is a button that opens a
          list; onValueChange gets the chosen item's value as a string, which
          here is always one of the SortOrder keys.
        */}
        <Select value={sort} onValueChange={(value) => onSortChange(value as SortOrder)}>
          <SelectTrigger id="sort" className="w-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        {/* A Switch is a toggle button (role="switch"); onCheckedChange gets the new state. */}
        <Switch id="only-with-cover" checked={onlyWithCover} onCheckedChange={onOnlyWithCoverChange} />
        <Label htmlFor="only-with-cover">Only books with a cover</Label>
      </div>
    </div>
  );
}
