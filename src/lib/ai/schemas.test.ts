import assert from "node:assert/strict";
import test from "node:test";
import { soujiDrawingSchema, tutorRequestSchema } from "./schemas";

test("accepts a bounded tutor request and rejects oversized input", () => {
  assert.equal(tutorRequestSchema.safeParse({ instrumentKey: "NSE_EQ|INE123", question: "Explain support" }).success, true);
  assert.equal(tutorRequestSchema.safeParse({ instrumentKey: "NSE_EQ|INE123", question: "x".repeat(801) }).success, false);
});

test("accepts live chart requests and bounds Souji drawings", () => {
  assert.equal(tutorRequestSchema.safeParse({
    instrumentKey: "NSE_EQ|INE123",
    question: "Read this chart",
    live: true,
    chartImages: ["data:image/jpeg;base64,abc"],
  }).success, true);

  assert.equal(soujiDrawingSchema.safeParse({
    explanation: "This level was tested twice.",
    overlays: Array.from({ length: 7 }, (_, index) => ({
      type: "horizontal-line",
      label: `Level ${index}`,
      price: 100 + index,
      from: null,
      to: null,
      time: null,
      tone: "info",
    })),
  }).success, false);
});
