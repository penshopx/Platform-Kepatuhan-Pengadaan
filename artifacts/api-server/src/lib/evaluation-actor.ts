import { clerkClient, getAuth } from "@clerk/express";
import type { Request } from "express";

export type EvaluationActor = { id: string; name: string };

export async function resolveEvaluationActor(req: Request): Promise<EvaluationActor | null> {
  const userId = getAuth(req).userId;
  if (!userId) return null;

  const user = await clerkClient.users.getUser(userId);
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return {
    id: userId,
    name: fullName || user.username?.trim() || `Pengguna ${userId}`,
  };
}