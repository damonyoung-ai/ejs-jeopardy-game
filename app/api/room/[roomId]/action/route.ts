import { NextRequest, NextResponse } from "next/server";
import {
  endGame,
  finalizeClue,
  lockAnswers,
  markPlayerDisconnected,
  openAnswers,
  publishRoomState,
  revealCorrect,
  selectClue,
  startGame,
  submitAnswer,
  submitTwistChoice,
  toggleTwist,
  triggerTwist,
  getRoom
} from "@/lib/roomStore";

const hostActions = new Set([
  "host:startGame",
  "host:selectClue",
  "host:openAnswers",
  "host:lockAnswers",
  "host:revealCorrect",
  "host:toggleTwistForClue",
  "host:triggerTwist",
  "host:finalizeClue",
  "host:endGame"
]);

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const roomId = params.roomId.toUpperCase();
    const body = await req.json();
    const action = String(body?.action || "");
    const room = getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    if (hostActions.has(action)) {
      const hostId = String(body?.hostId || "");
      if (hostId !== room.hostId) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
      }
    }

    switch (action) {
      case "host:startGame":
        startGame(roomId);
        break;
      case "host:selectClue":
        selectClue(roomId, String(body?.clueId || ""));
        break;
      case "host:openAnswers":
        openAnswers(roomId);
        break;
      case "host:lockAnswers":
        lockAnswers(roomId);
        break;
      case "host:revealCorrect":
        revealCorrect(roomId);
        break;
      case "host:toggleTwistForClue":
        toggleTwist(roomId, Boolean(body?.enabled));
        break;
      case "host:triggerTwist":
        triggerTwist(roomId);
        break;
      case "host:finalizeClue":
        finalizeClue(roomId);
        break;
      case "host:endGame":
        endGame(roomId);
        break;
      case "player:submitAnswer":
        submitAnswer(roomId, String(body?.playerId || ""), Number(body?.choiceIndex));
        break;
      case "player:submitTwistChoice":
        if (!["double", "keep", "risk", "no-penalty"].includes(body?.choice)) {
          return NextResponse.json({ error: "Invalid twist choice." }, { status: 400 });
        }
        submitTwistChoice(roomId, String(body?.playerId || ""), body?.choice);
        break;
      case "player:leave":
        markPlayerDisconnected(roomId, String(body?.playerId || ""));
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    publishRoomState(roomId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to process action.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
