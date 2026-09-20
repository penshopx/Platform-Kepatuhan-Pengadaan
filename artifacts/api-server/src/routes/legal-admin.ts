import { Router, type IRouter } from "express";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  businessRulesTable,
  db,
  legalSourcesTable,
  policyPackRulesTable,
  policyPacksTable,
  provisionsTable,
  ruleConditionsTable,
} from "@workspace/db";
import {
  AddPolicyPackRuleBody,
  AddPolicyPackRuleParams,
  AddPolicyPackRuleResponse,
  CreateBusinessRuleBody,
  CreateBusinessRuleResponse,
  CreateLegalSourceBody,
  CreateLegalSourceResponse,
  CreatePolicyPackBody,
  CreatePolicyPackResponse,
  CreateProvisionBody,
  CreateProvisionParams,
  CreateProvisionResponse,
  ComparePolicyPacksQueryParams,
  ComparePolicyPacksResponse,
  ListBusinessRulesResponse,
  ListLegalSourcesResponse,
  ListPolicyPacksResponse,
  TransitionPolicyPackBody,
  TransitionPolicyPackParams,
  TransitionPolicyPackResponse,
  UpdateLegalSourceBody,
  UpdateLegalSourceParams,
  UpdateLegalSourceResponse,
} from "@workspace/api-zod";
import {
  createRuleSnapshot,
  unverifiedSourcePublicationError,
} from "../lib/policy-engine";
import {
  comparePolicyPackRules,
  type ComparisonRule,
} from "../lib/policy-pack-comparison";
import { requireAdmin } from "../middlewares/require-admin";

const router: IRouter = Router();
const iso = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : value;
const nullableIso = (value: Date | string | null) =>
  value ? iso(value) : null;

function isDuplicatePolicyPackVersion(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: string; constraint?: string };
  return (
    databaseError.code === "23505" &&
    databaseError.constraint === "policy_pack_regime_version_unique"
  );
}

async function legalSourceResponse(
  source: typeof legalSourcesTable.$inferSelect,
) {
  const provisions = await db
    .select()
    .from(provisionsTable)
    .where(
      and(
        eq(provisionsTable.legalSourceId, source.id),
        isNull(provisionsTable.deletedAt),
      ),
    )
    .orderBy(asc(provisionsTable.articleNumber));
  return {
    ...source,
    verifiedAt: nullableIso(source.verifiedAt),
    createdAt: iso(source.createdAt),
    updatedAt: iso(source.updatedAt),
    provisions: provisions.map(({ legalSourceId: _, createdAt: __, deletedAt: ___, ...row }) => row),
  };
}

async function policyPackResponse(pack: typeof policyPacksTable.$inferSelect) {
  const rules = await db
    .select({
      id: policyPackRulesTable.id,
      businessRuleId: policyPackRulesTable.businessRuleId,
      ruleKey: businessRulesTable.ruleKey,
      ruleVersion: businessRulesTable.version,
      isMandatory: policyPackRulesTable.isMandatory,
      snapshot: policyPackRulesTable.snapshot,
    })
    .from(policyPackRulesTable)
    .innerJoin(
      businessRulesTable,
      eq(policyPackRulesTable.businessRuleId, businessRulesTable.id),
    )
    .where(eq(policyPackRulesTable.policyPackId, pack.id));
  return {
    ...pack,
    publishedAt: nullableIso(pack.publishedAt),
    createdAt: iso(pack.createdAt),
    updatedAt: iso(pack.updatedAt),
    rules: rules.map(({ snapshot, ...rule }) => ({
      ...rule,
      snapshotLocked: snapshot !== null,
    })),
  };
}

async function comparisonRules(pack: typeof policyPacksTable.$inferSelect) {
  const rows = await db
    .select({
      packRule: policyPackRulesTable,
      rule: businessRulesTable,
      condition: ruleConditionsTable,
      provision: provisionsTable,
      source: legalSourcesTable,
    })
    .from(policyPackRulesTable)
    .innerJoin(
      businessRulesTable,
      eq(policyPackRulesTable.businessRuleId, businessRulesTable.id),
    )
    .leftJoin(
      ruleConditionsTable,
      eq(policyPackRulesTable.ruleConditionId, ruleConditionsTable.id),
    )
    .innerJoin(
      provisionsTable,
      eq(businessRulesTable.provisionId, provisionsTable.id),
    )
    .innerJoin(
      legalSourcesTable,
      eq(provisionsTable.legalSourceId, legalSourcesTable.id),
    )
    .where(eq(policyPackRulesTable.policyPackId, pack.id));

  const useSnapshot =
    pack.status === "PUBLISHED" || pack.status === "RETIRED";
  return rows.map(({ packRule, rule, condition, provision, source }) => {
    if (useSnapshot) {
      if (!packRule.snapshot) {
        throw new Error(
          `Snapshot aturan ${rule.ruleKey} pada versi ${pack.version} tidak tersedia`,
        );
      }
      const snapshot = packRule.snapshot as {
        rule: Record<string, unknown>;
        condition: Record<string, unknown> | null;
        source: Record<string, unknown>;
        provision: Record<string, unknown>;
      };
      return {
        ruleKey: String(snapshot.rule.key),
        ruleVersion: Number(snapshot.rule.version),
        isMandatory: Boolean(snapshot.rule.mandatory),
        rule: snapshot.rule,
        condition: snapshot.condition,
        source: snapshot.source,
        provision: snapshot.provision,
      } satisfies ComparisonRule;
    }

    return {
      ruleKey: rule.ruleKey,
      ruleVersion: rule.version,
      isMandatory: packRule.isMandatory,
      rule: {
        id: rule.id,
        key: rule.ruleKey,
        category: rule.ruleCategory,
        description: rule.description,
        valueType: rule.valueType,
        defaultValue: rule.defaultValue,
        formulaAst: rule.formulaAst,
        allowedReferences: rule.allowedReferences,
        version: rule.version,
        mandatory: packRule.isMandatory,
      },
      condition: condition
        ? {
            entityType: condition.entityType,
            fundingSource: condition.fundingSource,
            procurementMethod: condition.procurementMethod,
            packageValueMin: condition.packageValueMin,
            packageValueMax: condition.packageValueMax,
            scopeType: condition.scopeType,
            scopeId: condition.scopeId,
            effectiveDate: condition.effectiveDate,
            expiryDate: condition.expiryDate,
          }
        : null,
      source: {
        id: source.id,
        regulationCode: source.regulationCode,
        title: source.title,
        issuingAuthority: source.issuingAuthority,
        authorityLevel: source.authorityLevel,
        isBinding: source.isBinding,
        verificationStatus: source.verificationStatus,
      },
      provision: {
        id: provision.id,
        articleNumber: provision.articleNumber,
        provisionType: provision.provisionType,
        rawText: provision.rawText,
      },
    } satisfies ComparisonRule;
  });
}

router.get("/legal-sources", requireAdmin, async (_req, res): Promise<void> => {
  const sources = await db
    .select()
    .from(legalSourcesTable)
    .where(isNull(legalSourcesTable.deletedAt))
    .orderBy(asc(legalSourcesTable.authorityLevel), asc(legalSourcesTable.title));
  res.json(
    ListLegalSourcesResponse.parse(
      await Promise.all(sources.map(legalSourceResponse)),
    ),
  );
});

router.post("/legal-sources", requireAdmin, async (req, res): Promise<void> => {
  const body = CreateLegalSourceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const actor = res.locals.adminActor as { id: string; role: "ADMIN" };
  const [source] = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_audit_context(${actor.id}, 'USER', ${actor.role}, 'Create legal source')`,
    );
    return tx.insert(legalSourcesTable).values(body.data).returning();
  });
  res
    .status(201)
    .json(CreateLegalSourceResponse.parse(await legalSourceResponse(source)));
});

router.patch("/legal-sources/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateLegalSourceParams.safeParse(req.params);
  const body = UpdateLegalSourceBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Perubahan sumber hukum tidak valid" });
    return;
  }
  const verificationChanged = body.data.verificationStatus !== undefined;
  const actor = res.locals.adminActor as { id: string; role: "ADMIN" };
  const verificationFields = verificationChanged
    ? body.data.verificationStatus === "VERIFIED"
      ? { verifiedAt: new Date(), verifiedBy: actor.id }
      : { verifiedAt: null, verifiedBy: null }
    : {};
  const safeUpdate = body.data;
  const [source] = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_audit_context(${actor.id}, 'USER', ${actor.role}, 'Update legal source')`,
    );
    return tx
      .update(legalSourcesTable)
      .set({
        ...safeUpdate,
        ...verificationFields,
        updatedAt: new Date(),
      })
      .where(eq(legalSourcesTable.id, params.data.id))
      .returning();
  });
  if (!source) {
    res.status(404).json({ error: "Sumber hukum tidak ditemukan" });
    return;
  }
  req.log.info(
    { legalSourceId: source.id, verificationChanged },
    "Legal source updated",
  );
  res.json(UpdateLegalSourceResponse.parse(await legalSourceResponse(source)));
});

router.post("/legal-sources/:id/provisions", requireAdmin, async (req, res): Promise<void> => {
  const params = CreateProvisionParams.safeParse(req.params);
  const body = CreateProvisionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Pasal tidak valid" });
    return;
  }
  const [source] = await db
    .select({ id: legalSourcesTable.id })
    .from(legalSourcesTable)
    .where(eq(legalSourcesTable.id, params.data.id));
  if (!source) {
    res.status(404).json({ error: "Sumber hukum tidak ditemukan" });
    return;
  }
  const actor = res.locals.adminActor as { id: string; role: "ADMIN" };
  const [provision] = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_audit_context(${actor.id}, 'USER', ${actor.role}, 'Create legal provision')`,
    );
    return tx
      .insert(provisionsTable)
      .values({ ...body.data, legalSourceId: source.id })
      .returning();
  });
  const { legalSourceId: _, createdAt: __, deletedAt: ___, ...response } =
    provision;
  res.status(201).json(CreateProvisionResponse.parse(response));
});

router.get("/business-rules", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      rule: businessRulesTable,
      sourceTitle: legalSourcesTable.title,
      articleNumber: provisionsTable.articleNumber,
    })
    .from(businessRulesTable)
    .innerJoin(
      provisionsTable,
      eq(businessRulesTable.provisionId, provisionsTable.id),
    )
    .innerJoin(
      legalSourcesTable,
      eq(provisionsTable.legalSourceId, legalSourcesTable.id),
    )
    .where(isNull(businessRulesTable.deletedAt))
    .orderBy(asc(businessRulesTable.ruleKey), asc(businessRulesTable.version));
  const conditions = rows.length
    ? await db
        .select()
        .from(ruleConditionsTable)
        .where(
          inArray(
            ruleConditionsTable.businessRuleId,
            rows.map(({ rule }) => rule.id),
          ),
        )
    : [];
  res.json(
    ListBusinessRulesResponse.parse(
      rows.map(({ rule, sourceTitle, articleNumber }) => ({
        ...rule,
        sourceTitle,
        articleNumber,
        conditions: conditions
          .filter((condition) => condition.businessRuleId === rule.id)
          .map(({ businessRuleId: _, createdAt: __, ...condition }) => condition),
      })),
    ),
  );
});

router.post("/business-rules", requireAdmin, async (req, res): Promise<void> => {
  const body = CreateBusinessRuleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const actor = res.locals.adminActor as { id: string; role: "ADMIN" };
  const created = await db.transaction(async (tx) => {
    const {
      effectiveDate,
      expiryDate,
      entityType,
      fundingSource,
      procurementMethod,
      packageValueMin,
      packageValueMax,
      scopeType,
      scopeId,
      ...ruleInput
    } = body.data;
    await tx.execute(
      sql`select set_audit_context(${actor.id}, 'USER', ${actor.role}, 'Create business rule version')`,
    );
    await tx
      .update(businessRulesTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(businessRulesTable.ruleKey, ruleInput.ruleKey));
    const [rule] = await tx
      .insert(businessRulesTable)
      .values({ ...ruleInput, allowedReferences: [] })
      .returning();
    const [condition] = await tx
      .insert(ruleConditionsTable)
      .values({
        businessRuleId: rule.id,
        effectiveDate,
        expiryDate,
        entityType,
        fundingSource,
        procurementMethod,
        packageValueMin,
        packageValueMax,
        scopeType,
        scopeId,
      })
      .returning();
    const [context] = await tx
      .select({
        sourceTitle: legalSourcesTable.title,
        articleNumber: provisionsTable.articleNumber,
      })
      .from(provisionsTable)
      .innerJoin(
        legalSourcesTable,
        eq(provisionsTable.legalSourceId, legalSourcesTable.id),
      )
      .where(eq(provisionsTable.id, rule.provisionId));
    const { businessRuleId: _, createdAt: __, ...conditionResponse } = condition;
    return {
      ...rule,
      ...context,
      conditions: [conditionResponse],
    };
  });
  res.status(201).json(CreateBusinessRuleResponse.parse(created));
});

router.get("/policy-packs", requireAdmin, async (_req, res): Promise<void> => {
  const packs = await db
    .select()
    .from(policyPacksTable)
    .orderBy(asc(policyPacksTable.packName), asc(policyPacksTable.version));
  res.json(
    ListPolicyPacksResponse.parse(
      await Promise.all(packs.map(policyPackResponse)),
    ),
  );
});

router.get("/policy-packs/compare", requireAdmin, async (req, res): Promise<void> => {
  const query = ComparePolicyPacksQueryParams.safeParse(req.query);
  if (!query.success || query.data.baseId === query.data.targetId) {
    res.status(400).json({ error: "Pilih dua versi policy pack yang berbeda" });
    return;
  }
  const packs = await db
    .select()
    .from(policyPacksTable)
    .where(
      inArray(policyPacksTable.id, [query.data.baseId, query.data.targetId]),
    );
  const base = packs.find((pack) => pack.id === query.data.baseId);
  const target = packs.find((pack) => pack.id === query.data.targetId);
  if (!base || !target) {
    res.status(404).json({ error: "Salah satu policy pack tidak ditemukan" });
    return;
  }
  if (
    base.packName !== target.packName ||
    base.regimeType !== target.regimeType
  ) {
    res.status(400).json({
      error: "Perbandingan hanya tersedia untuk nama dan regime yang sama",
    });
    return;
  }

  try {
    const [baseRules, targetRules] = await Promise.all([
      comparisonRules(base),
      comparisonRules(target),
    ]);
    const changes = comparePolicyPackRules(baseRules, targetRules);

    const metadata = (pack: typeof policyPacksTable.$inferSelect) => ({
      id: pack.id,
      packName: pack.packName,
      regimeType: pack.regimeType,
      version: pack.version,
      status: pack.status,
      dataSource:
        pack.status === "PUBLISHED" || pack.status === "RETIRED"
          ? ("SNAPSHOT" as const)
          : ("CURRENT" as const),
    });
    res.json(
      ComparePolicyPacksResponse.parse({
        base: metadata(base),
        target: metadata(target),
        summary: {
          added: changes.filter(({ changeType }) => changeType === "ADDED").length,
          removed: changes.filter(({ changeType }) => changeType === "REMOVED").length,
          changed: changes.filter(({ changeType }) => changeType === "CHANGED").length,
        },
        changes,
      }),
    );
  } catch (error) {
    req.log.warn({ error }, "Policy pack comparison rejected");
    res.status(400).json({
      error: error instanceof Error ? error.message : "Perbandingan gagal",
    });
  }
});

router.post("/policy-packs", requireAdmin, async (req, res): Promise<void> => {
  const body = CreatePolicyPackBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const actor = res.locals.adminActor as { id: string; role: "ADMIN" };
  try {
    const [pack] = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_audit_context(${actor.id}, 'USER', ${actor.role}, 'Create policy pack')`,
      );
      return tx.insert(policyPacksTable).values(body.data).returning();
    });
    res
      .status(201)
      .json(CreatePolicyPackResponse.parse(await policyPackResponse(pack)));
  } catch (error) {
    if (isDuplicatePolicyPackVersion(error)) {
      res.status(409).json({
        error: `Policy pack "${body.data.packName}" untuk regime ${body.data.regimeType} versi ${body.data.version} sudah ada`,
      });
      return;
    }
    throw error;
  }
});

router.post("/policy-packs/:id/rules", requireAdmin, async (req, res): Promise<void> => {
  const params = AddPolicyPackRuleParams.safeParse(req.params);
  const body = AddPolicyPackRuleBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Aturan policy pack tidak valid" });
    return;
  }
  const actor = res.locals.adminActor as { id: string; role: "ADMIN" };
  try {
    const pack = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_audit_context(${actor.id}, 'USER', ${actor.role}, 'Add policy pack rule')`,
      );
      const [lockedPack] = await tx
        .select()
        .from(policyPacksTable)
        .where(eq(policyPacksTable.id, params.data.id))
        .for("update");
      if (!lockedPack) return null;
      if (lockedPack.status !== "DRAFT") {
        throw new Error("Hanya policy pack DRAFT yang dapat diubah");
      }
      const [ownedCondition] = await tx
        .select({ id: ruleConditionsTable.id })
        .from(ruleConditionsTable)
        .where(
          and(
            eq(ruleConditionsTable.id, body.data.ruleConditionId),
            eq(ruleConditionsTable.businessRuleId, body.data.businessRuleId),
          ),
        );
      if (!ownedCondition) {
        throw new Error("Kondisi penerapan bukan milik aturan yang dipilih");
      }
      await tx.insert(policyPackRulesTable).values({
        policyPackId: lockedPack.id,
        ...body.data,
      });
      return lockedPack;
    });
    if (!pack) {
      res.status(404).json({ error: "Policy pack tidak ditemukan" });
      return;
    }
    res.json(AddPolicyPackRuleResponse.parse(await policyPackResponse(pack)));
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Aturan gagal ditambahkan",
    });
  }
});

router.patch("/policy-packs/:id/status", requireAdmin, async (req, res): Promise<void> => {
  const params = TransitionPolicyPackParams.safeParse(req.params);
  const body = TransitionPolicyPackBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Transisi policy pack tidak valid" });
    return;
  }
  const actor = res.locals.adminActor as { id: string; role: "ADMIN" };
  try {
    const updated = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_audit_context(${actor.id}, 'USER', ${actor.role}, ${`Transition policy pack to ${body.data.status}`})`,
      );
      const [pack] = await tx
        .select()
        .from(policyPacksTable)
        .where(eq(policyPacksTable.id, params.data.id))
        .for("update");
      if (!pack) return null;
      const allowed =
        (pack.status === "DRAFT" && body.data.status === "REVIEWED") ||
        (pack.status === "REVIEWED" && body.data.status === "PUBLISHED") ||
        (pack.status === "PUBLISHED" && body.data.status === "RETIRED");
      if (!allowed) {
        throw new Error(`Transisi ${pack.status} ke ${body.data.status} tidak diizinkan`);
      }
      const now = new Date();
      if (body.data.status === "PUBLISHED") {
        const rows = await tx
          .select({
            packRule: policyPackRulesTable,
            rule: businessRulesTable,
            condition: ruleConditionsTable,
            provision: provisionsTable,
            source: legalSourcesTable,
          })
          .from(policyPackRulesTable)
          .innerJoin(
            businessRulesTable,
            eq(policyPackRulesTable.businessRuleId, businessRulesTable.id),
          )
          .leftJoin(
            ruleConditionsTable,
            eq(policyPackRulesTable.ruleConditionId, ruleConditionsTable.id),
          )
          .innerJoin(
            provisionsTable,
            eq(businessRulesTable.provisionId, provisionsTable.id),
          )
          .innerJoin(
            legalSourcesTable,
            eq(provisionsTable.legalSourceId, legalSourcesTable.id),
          )
          .where(eq(policyPackRulesTable.policyPackId, pack.id));
        if (!rows.length) throw new Error("Policy pack belum memiliki aturan");
        const verificationError = unverifiedSourcePublicationError(
          rows.map(({ source }) => source),
        );
        if (verificationError) throw new Error(verificationError);
        for (const row of rows) {
          const content = {
            rule: {
              id: row.rule.id,
              key: row.rule.ruleKey,
              category: row.rule.ruleCategory,
              description: row.rule.description,
              valueType: row.rule.valueType,
              defaultValue: row.rule.defaultValue,
              formulaAst: row.rule.formulaAst,
              allowedReferences: row.rule.allowedReferences,
              version: row.rule.version,
              mandatory: row.packRule.isMandatory,
            },
            condition: row.condition
              ? {
                  entityType: row.condition.entityType,
                  fundingSource: row.condition.fundingSource,
                  procurementMethod: row.condition.procurementMethod,
                  packageValueMin: row.condition.packageValueMin,
                  packageValueMax: row.condition.packageValueMax,
                  scopeType: row.condition.scopeType,
                  scopeId: row.condition.scopeId,
                  effectiveDate: row.condition.effectiveDate,
                  expiryDate: row.condition.expiryDate,
                }
              : null,
            source: {
              id: row.source.id,
              regulationCode: row.source.regulationCode,
              title: row.source.title,
              issuingAuthority: row.source.issuingAuthority,
              authorityLevel: row.source.authorityLevel,
              isBinding: row.source.isBinding,
              verificationStatus: row.source.verificationStatus,
            },
            provision: {
              id: row.provision.id,
              articleNumber: row.provision.articleNumber,
              provisionType: row.provision.provisionType,
              rawText: row.provision.rawText,
            },
          };
          await tx
            .update(policyPackRulesTable)
            .set({
              snapshot: createRuleSnapshot(content),
              snapshotTakenAt: now,
            })
            .where(eq(policyPackRulesTable.id, row.packRule.id));
        }
      }
      const [result] = await tx
        .update(policyPacksTable)
        .set({
          status: body.data.status,
          publishedAt: body.data.status === "PUBLISHED" ? now : pack.publishedAt,
          publishedBy:
            body.data.status === "PUBLISHED" ? actor.id : pack.publishedBy,
          updatedAt: now,
        })
        .where(eq(policyPacksTable.id, pack.id))
        .returning();
      return result;
    });
    if (!updated) {
      res.status(404).json({ error: "Policy pack tidak ditemukan" });
      return;
    }
    res.json(
      TransitionPolicyPackResponse.parse(await policyPackResponse(updated)),
    );
  } catch (error) {
    req.log.warn({ error }, "Policy pack transition rejected");
    res.status(400).json({
      error: error instanceof Error ? error.message : "Transisi gagal",
    });
  }
});

export default router;