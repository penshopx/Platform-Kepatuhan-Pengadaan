import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const auth = getAuth(req);
  const userId = auth.userId;
  if (!userId) {
    res.status(401).json({ error: "Masuk sebagai admin untuk melanjutkan" });
    return;
  }
  try {
    const user = await clerkClient.users.getUser(userId);
    const role = user.publicMetadata.role;
    if (role !== "ADMIN" && role !== "LEGAL_ADMIN") {
      res.status(403).json({ error: "Akun ini tidak memiliki akses admin hukum" });
      return;
    }
    res.locals.adminActor = { id: userId, role: "ADMIN" as const };
    next();
  } catch (error) {
    req.log.error({ error, userId }, "Unable to authorize legal admin");
    res.status(503).json({ error: "Otorisasi admin tidak dapat diverifikasi" });
  }
};