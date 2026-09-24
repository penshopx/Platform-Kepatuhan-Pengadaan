import { Router, type IRouter } from "express";
import { and, desc, eq, ilike } from "drizzle-orm";
import {
  activitiesTable,
  db,
  decisionReferencesTable,
  epurchasingReviewsTable,
  procurementPackagesTable,
  regulationsTable,
  type PackageDocument,
  type PackageStep,
  type ReviewItem,
} from "@workspace/db";
import {
  CompleteEpurchasingReviewBody,
  CompleteEpurchasingReviewResponse,
  CreatePackageBody,
  CreatePackageResponse,
  GetDashboardResponse,
  GetPackageParams,
  GetPackageResponse,
  ListActivityResponse,
  ListEpurchasingReviewsResponse,
  ListPackagesQueryParams,
  ListPackagesResponse,
  ListRegulationsResponse,
  UpdatePackageBody,
  UpdatePackageParams,
  UpdatePackageResponse,
} from "@workspace/api-zod";
import { decisionEvaluatorLabel } from "../lib/decision-evaluator-label";

const router: IRouter = Router();

const iso = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : value;

const packageSummary = (
  row: typeof procurementPackagesTable.$inferSelect,
) => ({
  id: row.id,
  code: row.code,
  title: row.title,
  agency: row.agency,
  method: row.method,
  status: row.status,
  budget: row.budget,
  pdnTarget: row.pdnTarget,
  compliance: row.compliance,
  dueDate: row.dueDate,
  owner: row.owner,
  updatedAt: iso(row.updatedAt),
});

const reviewResponse = (
  row: typeof epurchasingReviewsTable.$inferSelect,
) => {
  const items = row.items as ReviewItem[];
  return {
    id: row.id,
    packageCode: row.packageCode,
    packageTitle: row.packageTitle,
    status: row.status,
    completed: items.filter((item) => item.completed).length,
    total: items.length,
    updatedAt: iso(row.updatedAt),
    items,
  };
};

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [packages, reviews] = await Promise.all([
    db.select().from(procurementPackagesTable),
    db.select().from(epurchasingReviewsTable),
  ]);

  const totalBudget = packages.reduce((sum, item) => sum + item.budget, 0);
  const complianceRate = packages.length
    ? packages.reduce((sum, item) => sum + item.compliance, 0) / packages.length
    : 0;
  const methodTotals = new Map<string, number>();
  for (const item of packages) {
    methodTotals.set(
      item.method,
      (methodTotals.get(item.method) ?? 0) + item.budget,
    );
  }

  const colors = ["#49B9FF", "#8B5CF6", "#2DD4BF", "#F59E0B"];
  const data = {
    totalPackages: packages.length,
    activePackages: packages.filter((item) => item.status !== "Selesai").length,
    reviewReady: reviews.filter((item) => {
      const items = item.items as ReviewItem[];
      return items.length > 0 && items.every((reviewItem) => reviewItem.completed);
    }).length,
    complianceRate: Math.round(complianceRate),
    totalBudget,
    budgetByMethod: [...methodTotals.entries()].map(([label, value], index) => ({
      label,
      value,
      color: colors[index % colors.length],
    })),
  };

  res.json(GetDashboardResponse.parse(data));
});

router.get("/packages", async (req, res): Promise<void> => {
  const parsed = ListPackagesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [];
  if (parsed.data.status) {
    conditions.push(eq(procurementPackagesTable.status, parsed.data.status));
  }
  if (parsed.data.search) {
    conditions.push(
      ilike(procurementPackagesTable.title, `%${parsed.data.search}%`),
    );
  }

  const rows = await db
    .select()
    .from(procurementPackagesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(procurementPackagesTable.updatedAt));

  res.json(ListPackagesResponse.parse(rows.map(packageSummary)));
});

router.post("/packages", async (req, res): Promise<void> => {
  const parsed = CreatePackageBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid package input");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [{ count }] = await db
    .select({ count: procurementPackagesTable.id })
    .from(procurementPackagesTable)
    .orderBy(desc(procurementPackagesTable.id))
    .limit(1);
  const next = (count ?? 0) + 1;
  const dueDate =
    parsed.data.dueDate ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

  const [created] = await db
    .insert(procurementPackagesTable)
    .values({
      code: `PBJ-2026-${String(next).padStart(3, "0")}`,
      title: parsed.data.title,
      agency: parsed.data.agency,
      method: parsed.data.method,
      budget: parsed.data.budget,
      owner: parsed.data.owner,
      dueDate,
      description: `Paket ${parsed.data.title} sedang disiapkan sesuai kebijakan pengadaan yang berlaku.`,
      steps: [
        { label: "Perencanaan paket", status: "aktif", date: null },
        { label: "Persiapan dokumen", status: "menunggu", date: null },
        { label: "Pemilihan penyedia", status: "menunggu", date: null },
      ] satisfies PackageStep[],
      documents: [] satisfies PackageDocument[],
    })
    .returning();

  await db.insert(activitiesTable).values({
    actor: parsed.data.owner,
    action: "membuat paket baru",
    target: created.code,
    tone: "info",
  });

  res.status(201).json(CreatePackageResponse.parse(packageSummary(created)));
});

router.get("/packages/:id", async (req, res): Promise<void> => {
  const params = GetPackageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(procurementPackagesTable)
    .where(eq(procurementPackagesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Paket tidak ditemukan" });
    return;
  }

  res.json(
    GetPackageResponse.parse({
      ...packageSummary(row),
      description: row.description,
      steps: row.steps as PackageStep[],
      documents: row.documents as PackageDocument[],
    }),
  );
});

router.patch("/packages/:id", async (req, res): Promise<void> => {
  const params = UpdatePackageParams.safeParse(req.params);
  const body = UpdatePackageBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db
    .update(procurementPackagesTable)
    .set(body.data)
    .where(eq(procurementPackagesTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Paket tidak ditemukan" });
    return;
  }

  await db.insert(activitiesTable).values({
    actor: updated.owner,
    action: "memperbarui status paket",
    target: updated.code,
    tone: "success",
  });
  res.json(UpdatePackageResponse.parse(packageSummary(updated)));
});

router.get("/regulations", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(regulationsTable)
    .orderBy(desc(regulationsTable.updatedAt));
  res.json(ListRegulationsResponse.parse(rows));
});

router.get("/reviews/epurchasing", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(epurchasingReviewsTable)
    .orderBy(desc(epurchasingReviewsTable.updatedAt));
  res.json(ListEpurchasingReviewsResponse.parse(rows.map(reviewResponse)));
});

router.post(
  "/reviews/epurchasing/complete",
  async (req, res): Promise<void> => {
    const body = CompleteEpurchasingReviewBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [review] = await db
      .select()
      .from(epurchasingReviewsTable)
      .where(eq(epurchasingReviewsTable.id, body.data.reviewId));
    if (!review) {
      res.status(404).json({ error: "Reviu tidak ditemukan" });
      return;
    }

    const items = (review.items as ReviewItem[]).map((item) =>
      item.id === body.data.itemId ? { ...item, completed: true } : item,
    );
    const allComplete = items.every((item) => item.completed);
    const [updated] = await db
      .update(epurchasingReviewsTable)
      .set({
        items,
        status: allComplete ? "Siap finalisasi" : "Dalam reviu",
      })
      .where(eq(epurchasingReviewsTable.id, review.id))
      .returning();

    await db.insert(activitiesTable).values({
      actor: "Tim Reviu",
      action: allComplete
        ? "menyelesaikan kertas kerja e-purchasing"
        : "menyelesaikan butir reviu",
      target: updated.packageCode,
      tone: "success",
    });
    res.json(CompleteEpurchasingReviewResponse.parse(reviewResponse(updated)));
  },
);

router.get("/activity", async (_req, res): Promise<void> => {
  const [rows, decisions] = await Promise.all([
    db
      .select()
      .from(activitiesTable)
      .orderBy(desc(activitiesTable.timestamp))
      .limit(20),
    db
      .select({
        id: decisionReferencesTable.id,
        entityId: decisionReferencesTable.entityId,
        evaluatedAt: decisionReferencesTable.evaluatedAt,
        evaluatedBy: decisionReferencesTable.evaluatedBy,
        evaluatorName: decisionReferencesTable.evaluatorName,
        actorType: decisionReferencesTable.actorType,
        evaluationResult: decisionReferencesTable.evaluationResult,
      })
      .from(decisionReferencesTable)
      .where(eq(decisionReferencesTable.entityType, "PROCUREMENT_PACKAGE"))
      .orderBy(desc(decisionReferencesTable.evaluatedAt))
      .limit(20),
  ]);

  const activity = [
    ...rows.map((row) => ({
      ...row,
      id: `activity-${row.id}`,
      timestamp: iso(row.timestamp),
    })),
    ...decisions.flatMap((decision) => {
      const packageId = Number(decision.entityId);
      if (!Number.isSafeInteger(packageId) || packageId <= 0) return [];

      return [{
        id: `decision-${decision.id}`,
        actor: decisionEvaluatorLabel(decision),
        action: "mengevaluasi kepatuhan",
        target: `Paket #${packageId}`,
        timestamp: iso(decision.evaluatedAt),
        tone:
          decision.evaluationResult.status === "COMPLIANT"
            ? "positive"
            : decision.evaluationResult.status === "NON_COMPLIANT"
              ? "negative"
              : "neutral",
        decisionReference: decision.id,
        packageId,
      }];
    }),
  ]
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, 20);

  res.json(
    ListActivityResponse.parse(activity),
  );
});

export default router;