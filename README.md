# Jeopardy With A Twist

A real-time multiplayer Jeopardy-style game with a host-controlled flow, multiple-choice clues, live scoring, and a Double or Nothing twist.

## Tech Stack
- Next.js App Router + TypeScript
- Tailwind CSS
- Realtime via Pusher (Socket.IO is unreliable on Vercel serverless WebSockets)

## Local Development
1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and add your Pusher credentials.

3. Run the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy to Vercel (GitHub)
1. Push this repo to GitHub.
2. Import it into Vercel.
3. Add the environment variables from `.env.example`.
4. Add Upstash Redis credentials (required for multiplayer on serverless).
4. Deploy.

## How to Host a Game
1. Go to `/host` and create a game.
2. Share the Game ID or QR code.
3. Start the game from the lobby.
4. Control the flow: select clue, open answers, lock, reveal, optional twist, finalize.

## How to Join a Game
1. Go to `/join`.
2. Enter your name and the Game ID.
3. Wait for the host to start.

## Question Set JSON
You can paste your own question set during host setup. Format:

```json
{
  "categories": [
    {
      "title": "Category Name",
      "clues": [
        {
          "value": 200,
          "question": "Clue text here",
          "choices": ["A", "B", "C", "D"],
          "correctIndex": 2
        }
      ]
    }
  ]
}
```

Validation rules:
- Each clue must have exactly 4 choices.
- `correctIndex` must be `0-3`.
- Any board shape works (not limited to 6x5), and the grid renders dynamically.

## Twist Rules
After reveal, the host can trigger Double or Nothing for 10 seconds:
- Correct players choose to double their earned points or keep them.
- Incorrect players choose to risk losing the clue value or take no penalty.

## Optional Auto-Open
Hosts can enable “Auto-open answers” to open the answer window immediately when a clue is selected, reducing host actions and Redis commands.

## Optional Auto-Finalize
Hosts can enable “Auto-finalize” to automatically finalize a clue after reveal (or after the twist window), reducing host actions and Redis commands.

## Notes on Realtime
Socket.IO requires long-lived WebSocket connections which are unreliable in Vercel serverless functions. This app uses Pusher for production-safe realtime while keeping the server authoritative and the game state in memory. You can swap the in-memory store for Redis later using `lib/roomStore.ts`.

## Notes on Serverless State
Vercel serverless functions are stateless across requests, so in-memory rooms will be lost between requests. Use Upstash Redis for production persistence:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## QR Code Base URL
Set `NEXT_PUBLIC_APP_URL` to your production domain so the host QR code always points to the correct public URL.
