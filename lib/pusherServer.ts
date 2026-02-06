import Pusher from "pusher";

export function getPusherServer() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    throw new Error("Missing Pusher environment variables.");
  }

  return new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true
  });
}
