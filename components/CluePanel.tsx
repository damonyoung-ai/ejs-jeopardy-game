import { Category, Clue, CurrentClue } from "@/lib/types";

function findClue(board: Category[], clueId: string | null): Clue | null {
  if (!clueId) return null;
  for (const category of board) {
    const found = category.clues.find((clue) => clue.id === clueId);
    if (found) return found;
  }
  return null;
}

function findCategoryTitle(board: Category[], clueId: string | null) {
  if (!clueId) return null;
  for (const category of board) {
    if (category.clues.some((clue) => clue.id === clueId)) return category.title;
  }
  return null;
}

export function CluePanel({
  board,
  currentClue
}: {
  board: Category[];
  currentClue: CurrentClue;
}) {
  const clue = findClue(board, currentClue.clueId);
  const categoryTitle = findCategoryTitle(board, currentClue.clueId);
  if (!clue) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-2xl text-jeopardyGold">${clue.value}</h2>
        <span className="uppercase text-sm tracking-wide text-white/70">{currentClue.phase}</span>
      </div>
      {categoryTitle && <p className="text-sm text-white/70 mb-4">{categoryTitle}</p>}
      <p className="text-xl sm:text-2xl font-semibold mb-6">{clue.question}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {clue.choices.map((choice, index) => {
          const reveal = currentClue.phase === "revealed" || currentClue.phase === "twist" || currentClue.phase === "final";
          const isCorrect = reveal && clue.correctIndex === index;
          return (
            <div
              key={choice}
              className={`rounded-lg border px-4 py-3 text-lg ${
                isCorrect ? "border-jeopardyGold bg-jeopardyGold/20" : "border-white/10 bg-white/5"
              }`}
            >
              <span className="font-bold mr-2">{String.fromCharCode(65 + index)}.</span>
              {choice}
            </div>
          );
        })}
      </div>
    </div>
  );
}
