import { nanoid } from "nanoid";
import { buildBoard, getSampleBoard } from "@/lib/questions";
import {
  AnswerMap,
  Category,
  Clue,
  CurrentClue,
  GameRoom,
  ResultsMap
} from "@/lib/types";
import { getPusherServer } from "@/lib/pusherServer";
import { Redis } from "@upstash/redis";

const useRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = useRedis ? Redis.fromEnv() : null;

const rooms = new Map<string, GameRoom>();
const countdownTimers = new Map<string, NodeJS.Timeout>();
const pendingAnswers = new Map<string, Map<string, number>>();
const answerFlushTimers = new Map<string, NodeJS.Timeout>();
const ROOM_PREFIX = "room:";
const ANSWERS_PREFIX = "room:answers:";
const RESULTS_PREFIX = "room:results:";
const SCORES_PREFIX = "room:scores:";

function createEmptyCurrentClue(): CurrentClue {
  return { clueId: null, phase: "idle" };
}

function findClue(board: Category[], clueId: string): Clue | undefined {
  for (const category of board) {
    const clue = category.clues.find((item) => item.id === clueId);
    if (clue) return clue;
  }
  return undefined;
}

function sanitizeBoardForPlayers(room: GameRoom): Category[] {
  return room.board.map((category) => ({
    title: category.title,
    clues: category.clues.map((clue) => {
      const isCurrent = room.currentClue.clueId === clue.id;
      const reveal =
        room.currentClue.phase === "revealed" ||
        room.currentClue.phase === "twist" ||
        room.currentClue.phase === "final";
      return {
        ...clue,
        correctIndex: isCurrent && reveal ? clue.correctIndex : -1
      };
    })
  }));
}

function sanitizeRoom(room: GameRoom, role: "host" | "player"): GameRoom {
  if (role === "host") return room;
  return {
    ...room,
    hostId: "",
    board: sanitizeBoardForPlayers(room),
    answers: {},
    results: {}
  };
}

async function assembleRoomState(roomId: string): Promise<GameRoom | null> {
  const room = await getRoomInternal(roomId);
  if (!room) return null;

  if (!useRedis || !redis) return room;

  const [scores, answers, results] = await Promise.all([
    getScores(roomId),
    getAnswers(roomId),
    getResults(roomId)
  ]);

  const players = room.players.map((player) => ({
    ...player,
    score: scores[player.id] ?? player.score ?? 0
  }));

  return {
    ...room,
    players,
    answers,
    results
  };
}

async function getRoomInternal(roomId: string): Promise<GameRoom | null> {
  if (useRedis && redis) {
    try {
      const room = await redis.get<GameRoom>(`${ROOM_PREFIX}${roomId}`);
      return room ?? null;
    } catch (error) {
      console.error("Upstash Redis get failed", error);
      throw new Error("Upstash Redis error. Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
    }
  }
  return rooms.get(roomId) || null;
}

async function setRoomInternal(room: GameRoom) {
  if (useRedis && redis) {
    try {
      await redis.set(`${ROOM_PREFIX}${room.id}`, room);
    } catch (error) {
      console.error("Upstash Redis set failed", error);
      throw new Error("Upstash Redis error. Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
    }
    return;
  }
  rooms.set(room.id, room);
}

async function getAnswers(roomId: string): Promise<AnswerMap> {
  if (!useRedis || !redis) return {};
  const raw = await redis.hgetall<Record<string, string>>(`${ANSWERS_PREFIX}${roomId}`);
  if (!raw) return {};
  const answers: AnswerMap = {};
  Object.entries(raw).forEach(([playerId, value]) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) answers[playerId] = parsed;
  });
  return answers;
}

async function setAnswers(roomId: string, answers: AnswerMap) {
  if (!useRedis || !redis) return;
  if (Object.keys(answers).length === 0) {
    await redis.del(`${ANSWERS_PREFIX}${roomId}`);
    return;
  }
  await redis.hset(`${ANSWERS_PREFIX}${roomId}`, answers);
}

async function clearAnswers(roomId: string) {
  if (!useRedis || !redis) return;
  await redis.del(`${ANSWERS_PREFIX}${roomId}`);
}

async function getResults(roomId: string): Promise<ResultsMap> {
  if (!useRedis || !redis) return {};
  const raw = await redis.get<string>(`${RESULTS_PREFIX}${roomId}`);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ResultsMap;
  } catch {
    return {};
  }
}

async function setResults(roomId: string, results: ResultsMap) {
  if (!useRedis || !redis) return;
  if (Object.keys(results).length === 0) {
    await redis.del(`${RESULTS_PREFIX}${roomId}`);
    return;
  }
  await redis.set(`${RESULTS_PREFIX}${roomId}`, JSON.stringify(results));
}

async function getScores(roomId: string): Promise<Record<string, number>> {
  if (!useRedis || !redis) return {};
  const raw = await redis.hgetall<Record<string, string>>(`${SCORES_PREFIX}${roomId}`);
  if (!raw) return {};
  const scores: Record<string, number> = {};
  Object.entries(raw).forEach(([playerId, value]) => {
    const parsed = Number(value);
    scores[playerId] = Number.isFinite(parsed) ? parsed : 0;
  });
  return scores;
}

async function setScores(roomId: string, scores: Record<string, number>) {
  if (!useRedis || !redis) return;
  if (Object.keys(scores).length === 0) {
    await redis.del(`${SCORES_PREFIX}${roomId}`);
    return;
  }
  await redis.hset(`${SCORES_PREFIX}${roomId}`, scores);
}

function queueAnswer(roomId: string, playerId: string, choiceIndex: number) {
  const roomQueue = pendingAnswers.get(roomId) ?? new Map<string, number>();
  roomQueue.set(playerId, choiceIndex);
  pendingAnswers.set(roomId, roomQueue);
}

async function flushPendingAnswers(roomId: string) {
  const queue = pendingAnswers.get(roomId);
  if (!queue || queue.size === 0) return;
  const room = await getRoomInternal(roomId);
  if (!room) return;

  queue.forEach((choiceIndex, playerId) => {
    room.answers[playerId] = choiceIndex;
  });

  pendingAnswers.delete(roomId);
  await setRoomInternal(room);
  if (useRedis && redis) {
    await setAnswers(roomId, room.answers);
  }
  await publishRoomState(roomId);
}

function scheduleAnswerFlush(roomId: string, delayMs = 750) {
  if (answerFlushTimers.has(roomId)) return;
  const timer = setTimeout(async () => {
    answerFlushTimers.delete(roomId);
    await flushPendingAnswers(roomId);
  }, delayMs);
  answerFlushTimers.set(roomId, timer);
}

export async function getRoom(roomId: string) {
  return getRoomInternal(roomId);
}

export async function createRoom(params: {
  hostId: string;
  title?: string;
  playerLimit: number;
  questionSetJson?: string;
  twistDefault: boolean;
}): Promise<GameRoom> {
  let board: Category[];
  if (params.questionSetJson) {
    const parsed = JSON.parse(params.questionSetJson);
    board = buildBoard(parsed);
  } else {
    board = getSampleBoard();
  }

  const room: GameRoom = {
    id: nanoid(6).toUpperCase(),
    hostId: params.hostId,
    status: "lobby",
    title: params.title,
    playerLimit: params.playerLimit,
    players: [],
    board,
    currentClue: createEmptyCurrentClue(),
    answers: {},
    results: {},
    twistDefault: params.twistDefault
  };

  await setRoomInternal(room);
  if (useRedis && redis) {
    await setScores(room.id, {});
    await setResults(room.id, {});
    await clearAnswers(room.id);
  }
  return room;
}

export async function joinRoom(roomId: string, name: string) {
  const room = await getRoomInternal(roomId);
  if (!room) throw new Error("Room not found.");

  const existing = room.players.find((player) => player.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.connected = true;
    await setRoomInternal(room);
    return existing;
  }

  if (room.players.length >= room.playerLimit) {
    throw new Error("Room is full.");
  }

  const player = {
    id: nanoid(8),
    name,
    score: 0,
    connected: true
  };

  room.players.push(player);
  await setRoomInternal(room);
  if (useRedis && redis) {
    const scores = await getScores(roomId);
    scores[player.id] = 0;
    await setScores(roomId, scores);
  }
  return player;
}

export async function markPlayerDisconnected(roomId: string, playerId: string) {
  const room = await getRoomInternal(roomId);
  if (!room) return;
  const player = room.players.find((entry) => entry.id === playerId);
  if (player) player.connected = false;
  await setRoomInternal(room);
}

export async function startGame(roomId: string) {
  const room = await getRoomInternal(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.status !== "lobby") return;
  room.status = "inProgress";
  await setRoomInternal(room);
}

export async function selectClue(roomId: string, clueId: string) {
  const room = await getRoomInternal(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.currentClue.phase !== "idle") {
    throw new Error("Finish the current clue first.");
  }
  const clue = findClue(room.board, clueId);
  if (!clue) throw new Error("Clue not found.");
  if (clue.used) throw new Error("Clue already used.");
  room.currentClue = {
    clueId,
    phase: "clue",
    openedAt: Date.now(),
    twistEnabled: room.twistDefault
  };
  room.answers = {};
  room.results = {};
  await setRoomInternal(room);
  if (useRedis && redis) {
    await clearAnswers(roomId);
    await setResults(roomId, {});
  }
}

export async function openAnswers(roomId: string) {
  const room = await getRoomInternal(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.currentClue.phase !== "clue") throw new Error("Clue not revealed.");
  room.currentClue.phase = "open";
  room.currentClue.openedAt = Date.now();
  await setRoomInternal(room);
}

export async function submitAnswer(roomId: string, playerId: string, choiceIndex: number) {
  const room = await getRoomInternal(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.currentClue.phase !== "open") throw new Error("Answers are not open.");
  const player = room.players.find((entry) => entry.id === playerId);
  if (!player) throw new Error("Player not found.");
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex > 3) {
    throw new Error("Invalid choice.");
  }
  if (useRedis && redis) {
    await redis.hset(`${ANSWERS_PREFIX}${roomId}`, { [playerId]: choiceIndex });
    return;
  }
  queueAnswer(roomId, playerId, choiceIndex);
  scheduleAnswerFlush(roomId);
}

export async function lockAnswers(roomId: string) {
  await flushPendingAnswers(roomId);
  const room = await getRoomInternal(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.currentClue.phase !== "open") throw new Error("Answers are not open.");
  room.currentClue.phase = "locked";
  room.currentClue.lockedAt = Date.now();
  await setRoomInternal(room);
}

export async function revealCorrect(roomId: string) {
  await flushPendingAnswers(roomId);
  const room = await getRoomInternal(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.currentClue.phase !== "locked") throw new Error("Answers not locked.");
  const clueId = room.currentClue.clueId;
  if (!clueId) throw new Error("No current clue.");
  const clue = findClue(room.board, clueId);
  if (!clue) throw new Error("Clue not found.");

  if (useRedis && redis) {
    room.answers = await getAnswers(roomId);
  }

  const results: ResultsMap = {};
  const scores = useRedis && redis ? await getScores(roomId) : {};

  room.players.forEach((player) => {
    const answer = room.answers[player.id];
    const correct = answer === clue.correctIndex;
    const delta = correct ? clue.value : 0;
    if (useRedis && redis) {
      scores[player.id] = (scores[player.id] ?? 0) + delta;
    } else if (delta !== 0) {
      player.score += delta;
    }
    results[player.id] = { correct, delta };
  });

  room.results = results;
  room.currentClue.phase = "revealed";
  room.currentClue.revealAt = Date.now();
  await setRoomInternal(room);
  if (useRedis && redis) {
    await setScores(roomId, scores);
    await setResults(roomId, results);
  }
}

export async function toggleTwist(roomId: string, enabled: boolean) {
  const room = await getRoomInternal(roomId);
  if (!room) throw new Error("Room not found.");
  room.currentClue.twistEnabled = enabled;
  await setRoomInternal(room);
}

export async function triggerTwist(roomId: string) {
  const room = await getRoomInternal(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.currentClue.phase !== "revealed") throw new Error("Reveal correct answer first.");
  if (!room.currentClue.twistEnabled) throw new Error("Twist disabled.");

  const deadline = Date.now() + 10_000;
  room.currentClue.phase = "twist";
  room.currentClue.twistDeadline = deadline;
  await setRoomInternal(room);

  startTwistCountdown(roomId, deadline);
}

export async function submitTwistChoice(
  roomId: string,
  playerId: string,
  choice: "double" | "keep" | "risk" | "no-penalty"
) {
  const room = await getRoomInternal(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.currentClue.phase !== "twist") throw new Error("Twist not active.");
  if (room.currentClue.twistDeadline && Date.now() > room.currentClue.twistDeadline) {
    throw new Error("Twist window closed.");
  }
  const player = room.players.find((entry) => entry.id === playerId);
  if (!player) throw new Error("Player not found.");

  if (useRedis && redis) {
    room.results = await getResults(roomId);
  }

  const clueId = room.currentClue.clueId;
  if (!clueId) throw new Error("No clue selected.");
  const clue = findClue(room.board, clueId);
  if (!clue) throw new Error("Clue not found.");

  const result = room.results[playerId];
  if (!result) throw new Error("No result for player.");
  if (result.twistChoice) return;

  if (result.correct && (choice === "double" || choice === "keep")) {
    result.twistChoice = choice;
    result.twistDelta = choice === "double" ? clue.value : 0;
  }

  if (!result.correct && (choice === "risk" || choice === "no-penalty")) {
    result.twistChoice = choice;
    result.twistDelta = choice === "risk" ? -clue.value : 0;
  }

  await setRoomInternal(room);
  if (useRedis && redis) {
    await setResults(roomId, room.results);
  }
}

export async function finalizeClue(roomId: string) {
  await flushPendingAnswers(roomId);
  const room = await getRoomInternal(roomId);
  if (!room) throw new Error("Room not found.");
  if (!(room.currentClue.phase === "revealed" || room.currentClue.phase === "twist")) {
    throw new Error("Clue is not ready to finalize.");
  }
  const clueId = room.currentClue.clueId;
  if (!clueId) throw new Error("No clue selected.");
  const clue = findClue(room.board, clueId);
  if (!clue) throw new Error("Clue not found.");

  if (useRedis && redis) {
    room.results = await getResults(roomId);
  }

  const scores = useRedis && redis ? await getScores(roomId) : {};

  Object.entries(room.results).forEach(([playerId, result]) => {
    if (result.twistDelta && result.twistDelta !== 0) {
      if (useRedis && redis) {
        scores[playerId] = (scores[playerId] ?? 0) + result.twistDelta;
      } else {
        const player = room.players.find((entry) => entry.id === playerId);
        if (player) player.score += result.twistDelta;
      }
    }
  });

  clue.used = true;
  room.currentClue = createEmptyCurrentClue();
  room.answers = {};
  room.results = {};
  pendingAnswers.delete(roomId);
  await setRoomInternal(room);
  if (useRedis && redis) {
    await setScores(roomId, scores);
    await setResults(roomId, {});
    await clearAnswers(roomId);
  }
  clearCountdown(roomId);
}

export async function endGame(roomId: string) {
  const room = await getRoomInternal(roomId);
  if (!room) throw new Error("Room not found.");
  room.status = "finished";
  room.currentClue.phase = "final";
  await setRoomInternal(room);
}

export async function publishRoomState(roomId: string) {
  const room = await assembleRoomState(roomId);
  if (!room) return;
  const pusher = getPusherServer();
  const hostChannel = `room-${roomId}-host`;
  const playerChannel = `room-${roomId}-player`;

  await pusher.trigger(hostChannel, "room:state", room);
  await pusher.trigger(playerChannel, "room:state", sanitizeRoom(room, "player"));
}

export function publishCountdown(roomId: string, secondsLeft: number) {
  const pusher = getPusherServer();
  void pusher.trigger(`room-${roomId}-player`, "countdown:update", { secondsLeft });
  void pusher.trigger(`room-${roomId}-host`, "countdown:update", { secondsLeft });
}

function startTwistCountdown(roomId: string, deadline: number) {
  clearCountdown(roomId);
  const timer = setInterval(() => {
    const secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    publishCountdown(roomId, secondsLeft);
    if (secondsLeft <= 0) {
      clearCountdown(roomId);
    }
  }, 1000);

  countdownTimers.set(roomId, timer);
}

function clearCountdown(roomId: string) {
  const timer = countdownTimers.get(roomId);
  if (timer) clearInterval(timer);
  countdownTimers.delete(roomId);
}

export async function getRoomStateForRole(roomId: string, role: "host" | "player") {
  const room = await assembleRoomState(roomId);
  if (!room) return null;
  return sanitizeRoom(room, role);
}
