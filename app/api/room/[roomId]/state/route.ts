import { NextRequest, NextResponse } from "next/server";
import { getRoomStateForRole } from "@/lib/roomStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId: rawRoomId } = await params;
  const roomId = rawRoomId.toUpperCase();
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") === "host" ? "host" : "player";
  const state = getRoomStateForRole(roomId, role);
  if (!state) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  return NextResponse.json(state);
}
