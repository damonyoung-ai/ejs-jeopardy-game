import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <div className="inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm uppercase tracking-[0.3em] text-jeopardyGold">
          Jeopardy With A Twist
        </div>
        <h1 className="font-display text-5xl sm:text-6xl text-white">Host a live Jeopardy showdown</h1>
        <p className="text-white/70 text-lg">
          Real-time multiplayer Jeopardy with multiple-choice clues, live scoring, and a Double or Nothing twist.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link className="btn-primary w-full sm:w-auto" href="/host">
            Host a Game
          </Link>
          <Link className="btn-secondary w-full sm:w-auto" href="/join">
            Join a Game
          </Link>
        </div>
      </div>
    </main>
  );
}
