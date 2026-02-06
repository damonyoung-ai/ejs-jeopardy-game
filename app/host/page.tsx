"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HostSetupPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [playerLimit, setPlayerLimit] = useState(12);
  const [questionSetJson, setQuestionSetJson] = useState("");
  const [twistDefault, setTwistDefault] = useState(true);
  const [autoOpenAnswers, setAutoOpenAnswers] = useState(true);
  const [autoFinalizeClue, setAutoFinalizeClue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || undefined,
          playerLimit,
          questionSetJson: questionSetJson.trim() || undefined,
          twistDefault,
          autoOpenAnswers,
          autoFinalizeClue
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Unable to create room.");

      localStorage.setItem(`jeopardy-host-${data.roomId}`, data.hostId);
      router.push(`/host/${data.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create room.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10">
      <form onSubmit={handleCreate} className="card w-full max-w-3xl space-y-5">
        <div>
          <h1 className="font-display text-3xl text-jeopardyGold">Host Setup</h1>
          <p className="text-white/70">Create a room and share the Game ID with players.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-white/70">Game Title (optional)</label>
            <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-white/70">Player Limit</label>
            <input
              className="input mt-1"
              type="number"
              min={2}
              max={12}
              value={playerLimit}
              onChange={(e) => setPlayerLimit(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <label className="text-sm text-white/70">Question Set JSON (optional)</label>
          <textarea
            className="input mt-1 min-h-[140px] font-mono text-sm"
            placeholder='Paste your question set JSON here. Leave blank to use the default sample set.'
            value={questionSetJson}
            onChange={(e) => setQuestionSetJson(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-3 text-white/80">
          <input
            type="checkbox"
            checked={twistDefault}
            onChange={(e) => setTwistDefault(e.target.checked)}
          />
          Twist enabled by default
        </label>
        <label className="flex items-center gap-3 text-white/80">
          <input
            type="checkbox"
            checked={autoOpenAnswers}
            onChange={(e) => setAutoOpenAnswers(e.target.checked)}
          />
          Auto-open answers when clue is selected
        </label>
        <label className="flex items-center gap-3 text-white/80">
          <input
            type="checkbox"
            checked={autoFinalizeClue}
            onChange={(e) => setAutoFinalizeClue(e.target.checked)}
          />
          Auto-finalize after reveal (or twist window)
        </label>
        {error && <p className="text-red-300 text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={loading} type="submit">
          {loading ? "Creating..." : "Create Game"}
        </button>
      </form>
    </main>
  );
}
