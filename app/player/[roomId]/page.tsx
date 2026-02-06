"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoomState } from "@/lib/useRoomState";
import { Category, Clue } from "@/lib/types";
import { Scoreboard } from "@/components/Scoreboard";
import { Confetti } from "@/components/Confetti";

function findClue(board: Category[], clueId: string | null): Clue | null {
  if (!clueId) return null;
  for (const category of board) {
    const found = category.clues.find((clue) => clue.id === clueId);
    if (found) return found;
  }
  return null;
}

async function sendAction(roomId: string, action: string, payload: Record<string, unknown>) {
  const res = await fetch(`/api/room/${roomId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Action failed.");
}

export default function PlayerRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = String(params.roomId || "").toUpperCase();
  const { room, countdown, error } = useRoomState(roomId, "player");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [twistChoice, setTwistChoice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const player = useMemo(() => room?.players.find((entry) => entry.id === playerId) || null, [room, playerId]);

  useEffect(() => {
    const stored = localStorage.getItem(`jeopardy-player-${roomId}`);
    if (!stored) {
      router.push(`/join?roomId=${roomId}`);
      return;
    }
    setPlayerId(stored);
  }, [roomId, router]);

  useEffect(() => {
    if (!playerId) return;
    const handleLeave = () => {
      navigator.sendBeacon(
        `/api/room/${roomId}/action`,
        JSON.stringify({ action: "player:leave", playerId })
      );
    };
    window.addEventListener("beforeunload", handleLeave);
    return () => window.removeEventListener("beforeunload", handleLeave);
  }, [roomId, playerId]);

  useEffect(() => {
    setSelectedAnswer(null);
    setTwistChoice(null);
  }, [room?.currentClue.clueId]);

  const clue = useMemo(() => (room ? findClue(room.board, room.currentClue.clueId) : null), [room]);
  const reveal = room?.currentClue.phase === "revealed" || room?.currentClue.phase === "twist" || room?.currentClue.phase === "final";

  async function submitAnswer(choiceIndex: number) {
    if (!playerId) return;
    setActionError(null);
    setSelectedAnswer(choiceIndex);
    try {
      await sendAction(roomId, "player:submitAnswer", { playerId, choiceIndex });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  async function submitTwist(choice: string) {
    if (!playerId) return;
    setActionError(null);
    setTwistChoice(choice);
    try {
      await sendAction(roomId, "player:submitTwistChoice", { playerId, choice });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-red-300">{error}</p>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-white/70">Loading room...</p>
      </main>
    );
  }

  if (room.status === "finished") {
    const winner = [...room.players].sort((a, b) => b.score - a.score)[0];
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <Confetti />
        <div className="card text-center space-y-4">
          <h1 className="font-display text-3xl text-jeopardyGold">Game Over</h1>
          {winner && <p className="text-xl">Winner: <span className="font-semibold">{winner.name}</span></p>}
          <Scoreboard players={room.players} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-8 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-jeopardyGold">{room.title || "Jeopardy"}</h1>
          <p className="text-white/70">Game ID: {room.id}</p>
          {player && <p className="text-white/80 mt-1">Your score: <span className="font-semibold">{player.score}</span></p>}
        </div>
        <Scoreboard players={room.players} compact />
      </header>

      {room.status === "lobby" && (
        <div className="card text-center">
          <p className="text-lg">Waiting for the host to start.</p>
        </div>
      )}

      {room.status === "inProgress" && !clue && (
        <div className="card text-center">
          <p className="text-lg">Waiting for the next clue.</p>
        </div>
      )}

      {room.status === "inProgress" && clue && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl text-jeopardyGold">${clue.value}</span>
            <span className="text-sm uppercase tracking-wide text-white/70">{room.currentClue.phase}</span>
          </div>
          <p className="text-2xl font-semibold">{clue.question}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {clue.choices.map((choice, index) => {
              const isCorrect = reveal && clue.correctIndex === index;
              const selected = selectedAnswer === index;
              return (
                <button
                  key={choice}
                  className={`rounded-lg border px-4 py-3 text-left text-lg transition ${
                    isCorrect
                      ? "border-jeopardyGold bg-jeopardyGold/20"
                      : selected
                        ? "border-white/80 bg-white/10"
                        : "border-white/10 bg-white/5"
                  }`}
                  disabled={room.currentClue.phase !== "open"}
                  onClick={() => submitAnswer(index)}
                >
                  <span className="font-bold mr-2">{String.fromCharCode(65 + index)}.</span>
                  {choice}
                </button>
              );
            })}
          </div>
          {room.currentClue.phase === "open" && selectedAnswer !== null && (
            <p className="text-white/70">Answer submitted.</p>
          )}

          {reveal && selectedAnswer !== null && (
            <div className="rounded-md bg-white/10 px-4 py-3">
              {clue.correctIndex === selectedAnswer ? (
                <p className="text-jeopardyGold font-semibold">Correct! +{clue.value}</p>
              ) : (
                <p className="text-white/70">Incorrect. No points this round.</p>
              )}
            </div>
          )}

          {room.currentClue.phase === "twist" && room.currentClue.twistEnabled && selectedAnswer !== null && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg text-jeopardyGold">Double or Nothing</h3>
                {countdown !== null && <span className="text-sm text-white/70">{countdown}s</span>}
              </div>
              {clue.correctIndex === selectedAnswer ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    className="btn-primary"
                    disabled={twistChoice !== null}
                    onClick={() => submitTwist("double")}
                  >
                    Double (+{clue.value})
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={twistChoice !== null}
                    onClick={() => submitTwist("keep")}
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    className="btn-primary"
                    disabled={twistChoice !== null}
                    onClick={() => submitTwist("risk")}
                  >
                    Risk (-{clue.value})
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={twistChoice !== null}
                    onClick={() => submitTwist("no-penalty")}
                  >
                    No Penalty
                  </button>
                </div>
              )}
            </div>
          )}

          {actionError && <p className="text-red-300 text-sm">{actionError}</p>}
        </div>
      )}
    </main>
  );
}
