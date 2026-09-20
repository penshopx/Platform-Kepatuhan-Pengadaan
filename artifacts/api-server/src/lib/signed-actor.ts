import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

export type TrustedActor = {
  id: string;
  role: "POLICY_PUBLISHER" | "ADMIN";
};

export function authenticateSignedActor(
  req: Request,
  headers: {
    "x-actor-id": string;
    "x-actor-role": TrustedActor["role"];
    "x-actor-timestamp": string;
  },
): TrustedActor | null {
  const secret = process.env.SESSION_SECRET;
  const signature = req.get("x-actor-signature");
  const timestamp = Number(headers["x-actor-timestamp"]);
  if (!secret || !signature || !Number.isFinite(timestamp)) return null;
  if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) return null;

  const path = req.originalUrl.split("?")[0];
  const payload = [
    headers["x-actor-timestamp"],
    req.method.toUpperCase(),
    path,
    headers["x-actor-id"],
    headers["x-actor-role"],
  ].join("\n");
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const providedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) return null;
  return { id: headers["x-actor-id"], role: headers["x-actor-role"] };
}