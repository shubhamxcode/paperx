import assert from "node:assert/strict";
import test from "node:test";
import { isConversationInScope } from "./conversation-scope";

test("isolates portfolio conversations from every stock conversation", () => {
  assert.equal(isConversationInScope(null, null), true);
  assert.equal(isConversationInScope("NSE_EQ|A", null), false);
  assert.equal(isConversationInScope(null, "NSE_EQ|A"), false);
});

test("isolates stock conversations by exact instrument key", () => {
  assert.equal(isConversationInScope("NSE_EQ|A", "NSE_EQ|A"), true);
  assert.equal(isConversationInScope("NSE_EQ|A", "NSE_EQ|B"), false);
});
