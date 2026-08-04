import assert from "node:assert/strict";
import test from "node:test";
import { learningOutputSchema, tutorRequestSchema } from "./schemas";

test("accepts a bounded tutor request and rejects oversized input", () => {
  assert.equal(tutorRequestSchema.safeParse({ instrumentKey: "NSE_EQ|INE123", question: "Explain support" }).success, true);
  assert.equal(tutorRequestSchema.safeParse({ instrumentKey: "NSE_EQ|INE123", question: "x".repeat(801) }).success, false);
});

test("requires exactly four quiz options", () => {
  const base = {
    answer: "This is a clear educational explanation.",
    factsUsed: [],
    overlays: [],
    followUps: [],
  };
  assert.equal(learningOutputSchema.safeParse({ ...base, quiz: { concept: "Support", question: "Where is support visible?", options: ["A", "B", "C"], correctAnswer: 0, explanation: "The low was tested." } }).success, false);
});
