import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getLearningSummary, recordQuizAttempt } from "@/lib/ai/persistence";
import { z } from "zod";

const answerSchema = z.object({
  instrumentKey: z.string().min(1).max(128),
  concept: z.string().min(2).max(60),
  question: z.string().min(5).max(240),
  selectedAnswer: z.number().int().min(0).max(3),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().min(5).max(500),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await getLearningSummary(session.user.id));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = answerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid quiz answer" }, { status: 400 });
  await recordQuizAttempt({ userId: session.user.id, ...parsed.data });
  return Response.json({ correct: parsed.data.selectedAnswer === parsed.data.correctAnswer });
}
