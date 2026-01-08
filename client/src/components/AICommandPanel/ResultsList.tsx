import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ResultsListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  onActivate: (item: T) => void;
  renderItem: (item: T) => ReactNode;
  getItemTitle?: (item: T) => string | undefined;
  heightClassName?: string;
}

export function ResultsList<T>({
  items,
  getKey,
  onActivate,
  renderItem,
  getItemTitle,
  heightClassName = "h-[200px]",
}: ResultsListProps<T>) {
  if (items.length === 0) return null;

  return (
    <ScrollArea className={heightClassName}>
      <div className="space-y-1 pr-3">
        {items.map((item) => (
          <div
            key={getKey(item)}
            className="flex items-center gap-2 text-xs p-2 rounded bg-muted/30 hover:bg-muted/50 cursor-pointer"
            onClick={() => onActivate(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActivate(item);
              }
            }}
            role="button"
            tabIndex={0}
            title={getItemTitle?.(item)}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
