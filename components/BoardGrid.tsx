import { Category } from "@/lib/types";
import clsx from "clsx";

export function BoardGrid({
  categories,
  onSelect
}: {
  categories: Category[];
  onSelect?: (clueId: string) => void;
}) {
  const clueRows = Math.max(...categories.map((cat) => cat.clues.length));

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}>
      {categories.map((category) => (
        <div key={category.title} className="flex flex-col gap-2">
          <div className="jeopardy-panel rounded-lg px-2 py-3 text-center text-jeopardyGold font-display text-lg">
            {category.title}
          </div>
          {Array.from({ length: clueRows }).map((_, idx) => {
            const clue = category.clues[idx];
            if (!clue) {
              return <div key={`${category.title}-${idx}`} className="h-20 sm:h-24 md:h-28 rounded-lg bg-white/5" />;
            }
            return (
              <button
                key={clue.id}
                className={clsx("board-tile", clue.used && "used")}
                disabled={clue.used || !onSelect}
                onClick={() => onSelect?.(clue.id)}
              >
                ${clue.value}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
