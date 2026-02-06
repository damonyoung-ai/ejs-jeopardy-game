"use client";

import { useEffect, useState } from "react";
import { GameRoom } from "@/lib/types";
import { getPusherClient } from "@/lib/pusherClient";

export function useRoomState(roomId: string, role: "host" | "player") {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const res = await fetch(`/api/room/${roomId}/state?role=${role}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Unable to load room.");
        if (active) setRoom(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load room.");
      }
    }

    load();

    let channel: { bind: (event: string, cb: (data: any) => void) => void; unbind_all: () => void } | null = null;
    try {
      const pusher = getPusherClient();
      channel = pusher.subscribe(`room-${roomId}-${role}`);
      channel.bind("room:state", (data: GameRoom) => {
        if (active) setRoom(data);
      });
      channel.bind("countdown:update", (data: { secondsLeft: number }) => {
        if (active) setCountdown(data.secondsLeft);
      });
    } catch (err) {
      if (active) setError(err instanceof Error ? err.message : "Realtime unavailable.");
      // Throttled polling fallback to reduce Redis reads.
      pollTimer = setInterval(load, 15000);
    }

    return () => {
      active = false;
      if (pollTimer) clearInterval(pollTimer);
      if (channel) {
        channel.unbind_all();
        try {
          const pusher = getPusherClient();
          pusher.unsubscribe(`room-${roomId}-${role}`);
        } catch {
          // Ignore cleanup errors when realtime isn't configured.
        }
      }
    };
  }, [roomId, role]);

  return { room, countdown, error };
}
