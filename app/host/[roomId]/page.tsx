"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { BoardGrid } from "@/components/BoardGrid";
import { Scoreboard } from "@/components/Scoreboard";
import { Confetti } from "@/components/Confetti";
import { CluePanel } from "@/components/CluePanel";
import { useRoomState } from "@/lib/useRoomState";
import { GameRoom } from "@/lib/types";

async function sendAction(roomId: string, action: string, payload: Record<string, unknown>) {
  const res = await fetch(`/api/room/${roomId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Action failed.");
}

export default function HostRoomPage() {
  const params = useParams();
  const roomId = String(params.roomId || "").toUpperCase();
  const { room, countdown, error } = useRoomState(roomId, "host");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const hostId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(`jeopardy-host-${roomId}`);
  }, [roomId]);

  useEffect(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || window.location.origin;
    const newJoinUrl = `${baseUrl}/join?roomId=${roomId}`;
    setJoinUrl(newJoinUrl);
    QRCode.toDataURL(newJoinUrl).then(setQrUrl).catch(() => setQrUrl(null));
  }, [roomId]);

  async function handleAction(action: string, payload: Record<string, unknown> = {}) {
    if (!hostId) return;
    setActionError(null);
    try {
      await sendAction(roomId, action, { hostId, ...payload });
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

  const currentClueActive = room.currentClue.phase !== "idle";

  return (
    <main className="min-h-screen px-6 py-8 space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-jeopardyGold">{room.title || "Host Dashboard"}</h1>
          <p className="text-white/70">Game ID: <span className="font-semibold text-white">{room.id}</span></p>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(room.id)}>
            Copy Game ID
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {qrUrl && <img src={qrUrl} alt="QR code" className="h-20 w-20 rounded bg-white p-1" />}
            {joinUrl && (
              <div className="flex items-center gap-2">
                <code className="text-xs text-white/80 bg-white/10 px-2 py-1 rounded max-w-[220px] truncate">
                  {joinUrl}
                </code>
                <button
                  className="btn-secondary text-xs"
                  onClick={() => navigator.clipboard.writeText(joinUrl)}
                >
                  Copy Link
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {room.status === "lobby" && (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="card">
            <h2 className="font-display text-2xl text-jeopardyGold mb-4">Lobby</h2>
            <div className="space-y-2">
              {room.players.length === 0 && <p className="text-white/70">Waiting for players to join.</p>}
              {room.players.map((player) => (
                <div key={player.id} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
                  <span>{player.name}</span>
                  <span className="text-xs text-white/60">{player.connected ? "online" : "offline"}</span>
                </div>
              ))}
            </div>
            <button className="btn-primary mt-6" onClick={() => handleAction("host:startGame")}
              disabled={room.players.length === 0}
            >
              Start Game
            </button>
          </div>
          <Scoreboard players={room.players} />
        </section>
      )}

      {room.status === "finished" && (
        <section className="card text-center space-y-4">
          <Confetti />
          <h2 className="font-display text-2xl text-jeopardyGold">Final Scoreboard</h2>
          <Scoreboard players={room.players} />
        </section>
      )}

      {room.status !== "lobby" && room.status !== "finished" && (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <BoardGrid
              categories={room.board}
              onSelect={
                room.currentClue.phase === "idle"
                  ? (clueId) => handleAction("host:selectClue", { clueId })
                  : undefined
              }
            />
            {currentClueActive && (
              <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                <div className="space-y-4">
                  <CluePanel board={room.board} currentClue={room.currentClue} />
                  {Object.keys(room.results).length > 0 && (
                    <div className="card">
                      <h3 className="font-display text-lg text-jeopardyGold mb-3">Who Got It</h3>
                      <div className="space-y-2">
                        {room.players.map((player) => {
                          const result = room.results[player.id];
                          if (!result) return null;
                          return (
                            <div key={player.id} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
                              <span>{player.name}</span>
                              <span className={result.correct ? "text-jeopardyGold" : "text-white/60"}>
                                {result.correct ? "Correct" : "Incorrect"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="card space-y-3">
                  <h3 className="font-display text-xl text-jeopardyGold">Controls</h3>
                  <p className="text-sm text-white/70">
                    Answers received: {Object.keys(room.answers).length}/{room.players.length}
                  </p>
                  <button
                    className="btn-primary w-full"
                    onClick={() => handleAction("host:openAnswers")}
                    disabled={room.currentClue.phase !== "clue" || room.autoOpenAnswers}
                  >
                    Open Answers
                  </button>
                  <button
                    className="btn-secondary w-full"
                    onClick={() => handleAction("host:lockAnswers")}
                    disabled={room.currentClue.phase !== "open"}
                  >
                    Lock Answers
                  </button>
                  <button
                    className="btn-primary w-full"
                    onClick={() => handleAction("host:revealCorrect")}
                    disabled={room.currentClue.phase !== "locked"}
                  >
                    Reveal Correct
                  </button>
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={room.currentClue.twistEnabled ?? room.twistDefault}
                      onChange={(e) => handleAction("host:toggleTwistForClue", { enabled: e.target.checked })}
                    />
                    Twist enabled for this clue
                  </label>
                  <button
                    className="btn-secondary w-full"
                    onClick={() => handleAction("host:triggerTwist")}
                    disabled={room.currentClue.phase !== "revealed" || !room.currentClue.twistEnabled}
                  >
                    Trigger Twist {countdown !== null && room.currentClue.phase === "twist" ? `(${countdown}s)` : ""}
                  </button>
                  <button
                    className="btn-primary w-full"
                    onClick={() => handleAction("host:finalizeClue")}
                    disabled={!(room.currentClue.phase === "revealed" || room.currentClue.phase === "twist")}
                  >
                    Finalize Clue
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <Scoreboard players={room.players} />
            <button className="btn-secondary w-full" onClick={() => handleAction("host:endGame")}>
              End Game
            </button>
            {actionError && <p className="text-red-300 text-sm">{actionError}</p>}
          </div>
        </section>
      )}
    </main>
  );
}
