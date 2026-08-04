import "server-only";
import { createGoogle } from "@ai-sdk/google";
import { serverEnv } from "@/lib/env/server";

export function paperxGoogle() {
  return createGoogle({ apiKey: serverEnv.geminiApiKey });
}

export function paperxGeminiModel() {
  return paperxGoogle()(serverEnv.geminiModel);
}
