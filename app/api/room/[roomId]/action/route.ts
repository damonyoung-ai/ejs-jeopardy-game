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

export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId: rawRoomId } = await params;
    const roomId = rawRoomId.toUpperCase();
    const body = await req.json();
    const action = String(body?.action || "");
    const room = await getRoom(roomId);
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
        await startGame(roomId);
        break;
      case "host:selectClue":
        await selectClue(roomId, String(body?.clueId || ""));
        break;
      case "host:openAnswers":
        await openAnswers(roomId);
        break;
      case "host:lockAnswers":
        await lockAnswers(roomId);
        break;
      case "host:revealCorrect":
        await revealCorrect(roomId);
        break;
      case "host:toggleTwistForClue":
        await toggleTwist(roomId, Boolean(body?.enabled));
        break;
      case "host:triggerTwist":
        await triggerTwist(roomId);
        break;
      case "host:finalizeClue":
        await finalizeClue(roomId);
        break;
      case "host:endGame":
        await endGame(roomId);
        break;
      case "player:submitAnswer":
        await submitAnswer(roomId, String(body?.playerId || ""), Number(body?.choiceIndex));
        break;
      case "player:submitTwistChoice":
        if (!["double", "keep", "risk", "no-penalty"].includes(body?.choice)) {
          return NextResponse.json({ error: "Invalid twist choice." }, { status: 400 });
        }
        await submitTwistChoice(roomId, String(body?.playerId || ""), body?.choice);
        break;
      case "player:leave":
        await markPlayerDisconnected(roomId, String(body?.playerId || ""));
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const shouldPublish =
      action === "host:startGame" ||
      action === "host:selectClue" ||
      action === "host:openAnswers" ||
      action === "host:lockAnswers" ||
      action === "host:revealCorrect" ||
      action === "host:triggerTwist" ||
      action === "host:finalizeClue" ||
      action === "host:endGame";

    if (shouldPublish) {
      await publishRoomState(roomId);
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to process action.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
