export type GameStatus = "lobby" | "inProgress" | "finished";
export type CluePhase = "idle" | "clue" | "open" | "locked" | "revealed" | "twist" | "final";

export type Player = {
  id: string;
  name: string;
  score: number;
  connected: boolean;
};

export type Clue = {
  id: string;
  value: number;
  question: string;
  choices: [string, string, string, string];
  correctIndex: number;
  used: boolean;
};

export type Category = {
  title: string;
  clues: Clue[];
};

export type CurrentClue = {
  clueId: string | null;
  phase: CluePhase;
  openedAt?: number;
  lockedAt?: number;
  revealAt?: number;
  twistEnabled?: boolean;
  twistDeadline?: number;
};

export type AnswerMap = Record<string, number>;

export type ResultEntry = {
  correct: boolean;
  delta: number;
  twistChoice?: "double" | "keep" | "risk" | "no-penalty";
  twistDelta?: number;
};

export type ResultsMap = Record<string, ResultEntry>;

export type GameRoom = {
  id: string;
  hostId: string;
  status: GameStatus;
  title?: string;
  playerLimit: number;
  players: Player[];
  board: Category[];
  currentClue: CurrentClue;
  answers: AnswerMap;
  results: ResultsMap;
  twistDefault: boolean;
};

export type QuestionSet = {
  categories: Array<{
    title: string;
    clues: Array<{
      value: number;
      question: string;
      choices: [string, string, string, string];
      correctIndex: number;
    }>;
  }>;
};
