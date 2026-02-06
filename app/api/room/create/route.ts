import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createRoom, publishRoomState } from "@/lib/roomStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const hostId = nanoid(10);
    const title = body?.title ? String(body.title) : undefined;
    const requestedLimit = Number(body?.playerLimit ?? 12);
    const playerLimit = Number.isFinite(requestedLimit)
      ? Math.min(12, Math.max(2, requestedLimit))
      : 12;
    const questionSetJson = body?.questionSetJson ? String(body.questionSetJson) : undefined;
    const twistDefault = Boolean(body?.twistDefault ?? true);

    const room = await createRoom({
      hostId,
      title,
      playerLimit,
      questionSetJson,
      twistDefault
    });

    await publishRoomState(room.id);

    return NextResponse.json({ roomId: room.id, hostId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to create room.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
