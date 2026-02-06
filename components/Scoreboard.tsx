import { Player } from "@/lib/types";
import clsx from "clsx";

export function Scoreboard({ players, compact = false }: { players: Player[]; compact?: boolean }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const display = compact ? sorted.slice(0, 5) : sorted;

  return (
    <div className="card">
      <h3 className="font-display text-xl text-jeopardyGold mb-4">Scoreboard</h3>
      <div className="space-y-2">
        {display.length === 0 && <p className="text-white/70">No players yet.</p>}
        {display.map((player, index) => (
          <div
            key={player.id}
            className={clsx(
              "flex items-center justify-between rounded-md px-3 py-2",
              index === 0 ? "bg-jeopardyGold/20 text-jeopardyGold" : "bg-white/5"
            )}
          >
            <span className="font-semibold">
              {player.name}
              {!player.connected && " (offline)"}
            </span>
            <span className="font-display text-lg">{player.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
