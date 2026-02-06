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

const rooms = new Map<string, GameRoom>();
const countdownTimers = new Map<string, NodeJS.Timeout>();

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
      const reveal = room.currentClue.phase === "revealed" || room.currentClue.phase === "twist" || room.currentClue.phase === "final";
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

export function getRoom(roomId: string) {
  return rooms.get(roomId) || null;
}

export function createRoom(params: {
  hostId: string;
  title?: string;
  playerLimit: number;
  questionSetJson?: string;
  twistDefault: boolean;
}): GameRoom {
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

  rooms.set(room.id, room);
  return room;
}

export function joinRoom(roomId: string, name: string) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found.");

  const existing = room.players.find((player) => player.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.connected = true;
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
  return player;
}

export function markPlayerDisconnected(roomId: string, playerId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const player = room.players.find((entry) => entry.id === playerId);
  if (player) player.connected = false;
}

export function startGame(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.status !== "lobby") return;
  room.status = "inProgress";
}

export function selectClue(roomId: string, clueId: string) {
  const room = rooms.get(roomId);
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
}

export function openAnswers(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.currentClue.phase !== "clue") throw new Error("Clue not revealed.");
  room.currentClue.phase = "open";
  room.currentClue.openedAt = Date.now();
}

export function submitAnswer(roomId: string, playerId: string, choiceIndex: number) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.currentClue.phase !== "open") throw new Error("Answers are not open.");
  const player = room.players.find((entry) => entry.id === playerId);
  if (!player) throw new Error("Player not found.");
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex > 3) {
    throw new Error("Invalid choice.");
  }
  room.answers[playerId] = choiceIndex;
}

export function lockAnswers(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.currentClue.phase !== "open") throw new Error("Answers are not open.");
  room.currentClue.phase = "locked";
  room.currentClue.lockedAt = Date.now();
}

export function revealCorrect(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.currentClue.phase !== "locked") throw new Error("Answers not locked.");
  const clueId = room.currentClue.clueId;
  if (!clueId) throw new Error("No current clue.");
  const clue = findClue(room.board, clueId);
  if (!clue) throw new Error("Clue not found.");

  const results: ResultsMap = {};
  room.players.forEach((player) => {
    const answer = room.answers[player.id];
    const correct = answer === clue.correctIndex;
    const delta = correct ? clue.value : 0;
    if (delta !== 0) {
      player.score += delta;
    }
    results[player.id] = { correct, delta };
  });

  room.results = results;
  room.currentClue.phase = "revealed";
  room.currentClue.revealAt = Date.now();
}

export function toggleTwist(roomId: string, enabled: boolean) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  room.currentClue.twistEnabled = enabled;
}

export function triggerTwist(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.currentClue.phase !== "revealed") throw new Error("Reveal correct answer first.");
  if (!room.currentClue.twistEnabled) throw new Error("Twist disabled.");

  const deadline = Date.now() + 10_000;
  room.currentClue.phase = "twist";
  room.currentClue.twistDeadline = deadline;

  startTwistCountdown(roomId, deadline);
}

export function submitTwistChoice(roomId: string, playerId: string, choice: "double" | "keep" | "risk" | "no-penalty") {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.currentClue.phase !== "twist") throw new Error("Twist not active.");
  if (room.currentClue.twistDeadline && Date.now() > room.currentClue.twistDeadline) {
    throw new Error("Twist window closed.");
  }
  const player = room.players.find((entry) => entry.id === playerId);
  if (!player) throw new Error("Player not found.");

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
}

export function finalizeClue(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  if (!(room.currentClue.phase === "revealed" || room.currentClue.phase === "twist")) {
    throw new Error("Clue is not ready to finalize.");
  }
  const clueId = room.currentClue.clueId;
  if (!clueId) throw new Error("No clue selected.");
  const clue = findClue(room.board, clueId);
  if (!clue) throw new Error("Clue not found.");

  Object.entries(room.results).forEach(([playerId, result]) => {
    if (result.twistDelta && result.twistDelta !== 0) {
      const player = room.players.find((entry) => entry.id === playerId);
      if (player) player.score += result.twistDelta;
    }
  });

  clue.used = true;
  room.currentClue = createEmptyCurrentClue();
  room.answers = {};
  room.results = {};
  clearCountdown(roomId);
}

export function endGame(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  room.status = "finished";
  room.currentClue.phase = "final";
}

export function publishRoomState(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const pusher = getPusherServer();
  const hostChannel = `room-${roomId}-host`;
  const playerChannel = `room-${roomId}-player`;

  void pusher.trigger(hostChannel, "room:state", room);
  void pusher.trigger(playerChannel, "room:state", sanitizeRoom(room, "player"));
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

export function getRoomStateForRole(roomId: string, role: "host" | "player") {
  const room = rooms.get(roomId);
  if (!room) return null;
  return sanitizeRoom(room, role);
}
