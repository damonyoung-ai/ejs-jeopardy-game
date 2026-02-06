"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [roomId, setRoomId] = useState(params.get("roomId") || "");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/room/${roomId.trim().toUpperCase()}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Unable to join room.");

      const normalizedId = roomId.trim().toUpperCase();
      localStorage.setItem(`jeopardy-player-${normalizedId}`, data.playerId);
      localStorage.setItem(`jeopardy-player-name-${normalizedId}`, data.name);
      router.push(`/player/${normalizedId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join room.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleJoin} className="card w-full max-w-lg space-y-4">
        <h1 className="font-display text-3xl text-jeopardyGold">Join a Game</h1>
        <div>
          <label className="text-sm text-white/70">Game ID</label>
          <input className="input mt-1" value={roomId} onChange={(e) => setRoomId(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm text-white/70">Your Name</label>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        {error && <p className="text-red-300 text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={loading} type="submit">
          {loading ? "Joining..." : "Join Game"}
        </button>
      </form>
    </main>
  );
}
