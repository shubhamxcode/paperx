import assert from "node:assert/strict";
import test from "node:test";
import { soujiDrawingSchema, tutorRequestSchema } from "./schemas";

const question = "Review my portfolio";

test("accepts isolated portfolio and stock scopes", () => {
  assert.equal(
    tutorRequestSchema.safeParse({ surface: "portfolio", question }).success,
    true
  );
  assert.equal(
    tutorRequestSchema.safeParse({
      surface: "stock",
      instrumentKey: "NSE_EQ|TEST",
      question: "Explain this chart",
    }).success,
    true
  );
});

test("rejects cross-scoped instrument and chart data", () => {
  assert.equal(
    tutorRequestSchema.safeParse({
      surface: "stock",
      question: "Explain this chart",
    }).success,
    false
  );
  assert.equal(
    tutorRequestSchema.safeParse({
      surface: "portfolio",
      instrumentKey: "NSE_EQ|TEST",
      question,
    }).success,
    false
  );
  assert.equal(
    tutorRequestSchema.safeParse({
      surface: "portfolio",
      question,
      chartImages: ["data:image/png;base64,abc"],
    }).success,
    false
  );
});

test("accepts a bounded tutor request and rejects oversized input", () => {
  assert.equal(tutorRequestSchema.safeParse({ surface: "stock", instrumentKey: "NSE_EQ|INE123", question: "Explain support" }).success, true);
  assert.equal(tutorRequestSchema.safeParse({ surface: "stock", instrumentKey: "NSE_EQ|INE123", question: "x".repeat(801) }).success, false);
});

test("accepts one-time chart captures and bounds Souji drawings", () => {
  assert.equal(tutorRequestSchema.safeParse({
    surface: "stock",
    instrumentKey: "NSE_EQ|INE123",
    question: "Read this chart",
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
