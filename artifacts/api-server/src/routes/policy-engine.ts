import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  businessRulesTable,
  db,
  decisionReferencesTable,
  legalSourcesTable,
  policyPackRulesTable,
  policyPacksTable,
  provisionsTable,
  ruleConditionsTable,
} from "@workspace/db";
import {
  EvaluateRulesBody,
  EvaluateRulesResponse,
  PublishPolicyPackHeader,
  PublishPolicyPackParams,
  PublishPolicyPackResponse,
} from "@workspace/api-zod";
import {
  EVALUATOR_VERSION,
  evaluateRuleSnapshot,
  snapshotHash,
  type RuleSnapshot,
} from "../lib/policy-engine";
import { authenticateSignedActor } from "../lib/signed-actor";

const router: IRouter = Router();

router.post("/policy-packs/:id/publish", async (req, res): Promise<void> => {
  const params = PublishPolicyPackParams.safeParse(req.params);
  const headers = PublishPolicyPackHeader.safeParse(req.headers);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!headers.success) {
    res.status(401).json({ error: "Identitas penerbit tidak valid" });
    return;
  }
  const actor = authenticateSignedActor(req, headers.data);
  if (!actor) {
    res.status(401).json({ error: "Tanda tangan penerbit tidak valid" });
    return;
  }

  try {
    const published = await db.transaction(async (tx) => {
      const [pack] = await tx
        .select()
        .from(policyPacksTable)
        .where(eq(policyPacksTable.id, params.data.id))
        .for("update");
      if (!pack) return null;
      if (pack.status !== "REVIEWED") {
        throw new Error("Hanya policy pack REVIEWED yang dapat dipublikasikan");
      }

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

      await tx.execute(
        sql`select set_audit_context(${actor.id}, 'USER', ${actor.role}, 'Publish reviewed policy pack')`,
      );
      const snapshotTakenAt = new Date();
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
            snapshot: { ...content, hash: snapshotHash(content) },
            snapshotTakenAt,
          })
          .where(eq(policyPackRulesTable.id, row.packRule.id));
      }

      const [updated] = await tx
        .update(policyPacksTable)
        .set({
          status: "PUBLISHED",
          publishedAt: snapshotTakenAt,
          publishedBy: actor.id,
          updatedAt: snapshotTakenAt,
        })
        .where(eq(policyPacksTable.id, pack.id))
        .returning();
      return { pack: updated, ruleCount: rows.length };
    });

    if (!published) {
      res.status(404).json({ error: "Policy pack tidak ditemukan" });
      return;
    }
    res.json(
      PublishPolicyPackResponse.parse({
        id: published.pack.id,
        packName: published.pack.packName,
        regimeType: published.pack.regimeType,
        version: published.pack.version,
        status: published.pack.status,
        publishedAt: published.pack.publishedAt?.toISOString(),
        publishedBy: published.pack.publishedBy,
        ruleCount: published.ruleCount,
      }),
    );
  } catch (error) {
    req.log.warn({ error }, "Policy pack publication rejected");
    res.status(400).json({
      error: error instanceof Error ? error.message : "Publikasi gagal",
    });
  }
});

router.post("/rule-evaluations", async (req, res): Promise<void> => {
  const body = EvaluateRulesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [pack] = await tx
        .select()
        .from(policyPacksTable)
        .where(
          and(
            eq(policyPacksTable.id, body.data.policyPackId),
            eq(policyPacksTable.status, "PUBLISHED"),
          ),
        );
      if (!pack) return null;

      const packRules = await tx
        .select({ snapshot: policyPackRulesTable.snapshot })
        .from(policyPackRulesTable)
        .where(eq(policyPackRulesTable.policyPackId, pack.id));
      const snapshots = packRules.map((row) => {
        if (!row.snapshot) throw new Error("Snapshot aturan tidak tersedia");
        return row.snapshot as RuleSnapshot;
      });
      const rules = snapshots.map((snapshot) =>
        evaluateRuleSnapshot(snapshot, {
          entityType: body.data.entityType,
          context: body.data.context,
        }),
      );
      const failed = rules.filter((rule) => rule.output.status === "FAIL").length;
      const mandatoryFailed = rules.filter(
        (rule) =>
          rule.rule.mandatory && rule.output.status === "FAIL",
      ).length;
      const passed = rules.filter((rule) => rule.output.status === "PASS").length;
      const notApplicable = rules.length - failed - passed;
      const output = {
        status:
          mandatoryFailed > 0
            ? ("NON_COMPLIANT" as const)
            : passed > 0
              ? ("COMPLIANT" as const)
              : ("NOT_APPLICABLE" as const),
        passed,
        failed,
        mandatoryFailed,
        notApplicable,
      };
      const policyPack = {
        id: pack.id,
        name: pack.packName,
        version: pack.version,
        status: "PUBLISHED" as const,
      };
      const snapshot = {
        policyPack,
        evaluation: { input: body.data, output, rules },
        ruleSnapshots: snapshots,
        evaluatorVersion: EVALUATOR_VERSION,
      };

      const [decision] = await tx
        .insert(decisionReferencesTable)
        .values({
          entityType: body.data.entityType,
          entityId: body.data.entityId,
          policyPackId: pack.id,
          policyPackVersion: pack.version,
          evaluationInput: body.data,
          evaluationResult: output,
          snapshot,
          evaluatorVersion: EVALUATOR_VERSION,
          actorType: "SYSTEM",
        })
        .returning({ id: decisionReferencesTable.id });
      return {
        decisionReference: decision.id,
        policyPack,
        input: body.data,
        output,
        rules,
      };
    });

    if (!result) {
      res.status(404).json({ error: "Policy pack PUBLISHED tidak ditemukan" });
      return;
    }
    res.status(201).json(EvaluateRulesResponse.parse(result));
  } catch (error) {
    req.log.warn({ error }, "Rule evaluation rejected");
    res.status(400).json({
      error: error instanceof Error ? error.message : "Evaluasi gagal",
    });
  }
});

export default router;