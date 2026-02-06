import { NextRequest, NextResponse } from "next/server";
import { joinRoom, publishRoomState } from "@/lib/roomStore";

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const roomId = params.roomId.toUpperCase();
    const body = await req.json();
    const name = String(body?.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const player = joinRoom(roomId, name);
    publishRoomState(roomId);

    return NextResponse.json({ playerId: player.id, name: player.name });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to join room.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
