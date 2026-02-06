import sampleQuestions from "@/data/sampleQuestions.json";
import { Category, QuestionSet } from "@/lib/types";
import { nanoid } from "nanoid";

export function validateQuestionSet(input: QuestionSet) {
  if (!input || !Array.isArray(input.categories) || input.categories.length === 0) {
    throw new Error("Question set must include categories.");
  }

  input.categories.forEach((category, idx) => {
    if (!category.title || !Array.isArray(category.clues)) {
      throw new Error(`Category ${idx + 1} is missing title or clues.`);
    }

    category.clues.forEach((clue, clueIdx) => {
      if (typeof clue.value !== "number") {
        throw new Error(`Category ${idx + 1}, clue ${clueIdx + 1} missing value.`);
      }
      if (!clue.question || !Array.isArray(clue.choices) || clue.choices.length !== 4) {
        throw new Error(`Category ${idx + 1}, clue ${clueIdx + 1} invalid choices.`);
      }
      if (clue.correctIndex < 0 || clue.correctIndex > 3) {
        throw new Error(`Category ${idx + 1}, clue ${clueIdx + 1} invalid correctIndex.`);
      }
    });
  });
}

export function buildBoard(input: QuestionSet): Category[] {
  validateQuestionSet(input);
  return input.categories.map((category) => ({
    title: category.title,
    clues: category.clues.map((clue) => ({
      id: nanoid(8),
      value: clue.value,
      question: clue.question,
      choices: [clue.choices[0], clue.choices[1], clue.choices[2], clue.choices[3]],
      correctIndex: clue.correctIndex,
      used: false
    }))
  }));
}

export function getSampleBoard() {
  return buildBoard(sampleQuestions as QuestionSet);
}
