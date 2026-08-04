import "server-only";
import { createGoogle } from "@ai-sdk/google";
import { serverEnv } from "@/lib/env/server";

export function paperxGeminiModel() {
  return createGoogle({ apiKey: serverEnv.geminiApiKey })(serverEnv.geminiModel);
}
