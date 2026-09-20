import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import {
  EVALUATOR_VERSION,
  evaluateRuleSnapshot,
  snapshotHash,
  type RuleSnapshot,
} from "../lib/policy-engine";

const client = await pool.connect();

try {
  await client.query("BEGIN");
  const suffix = randomUUID().slice(0, 8);
  const source = await client.query<{ id: string }>(
    `INSERT INTO legal_sources (
      regulation_code, regulation_type, number, year, title,
      issuing_authority, authority_level, is_binding, status,
      verification_status
    ) VALUES ($1, 'TEST', '1', 2026, 'Policy engine test', 'Test Authority',
      99, true, 'ACTIVE', 'VERIFIED') RETURNING id`,
    [`POLICY-ENGINE-${suffix}`],
  );
  const provision = await client.query<{ id: string }>(
    `INSERT INTO provisions (
      legal_source_id, article_number, provision_type, raw_text
    ) VALUES ($1, '1', 'COMPLIANCE', 'Package value must meet threshold')
    RETURNING id`,
    [source.rows[0].id],
  );
  const formula = {
    type: "operator",
    operator: "gte",
    operands: [
      { type: "reference", path: "packageValue" },
      { type: "literal", value: 100 },
    ],
  };
  const rule = await client.query<{ id: string }>(
    `INSERT INTO business_rules (
      provision_id, rule_key, rule_category, value_type, formula_ast,
      allowed_references
    ) VALUES ($1, $2, 'COMPLIANCE', 'BOOLEAN', $3::jsonb, $4::jsonb)
    RETURNING id`,
    [
      provision.rows[0].id,
      `minimum_value_${suffix}`,
      JSON.stringify(formula),
      JSON.stringify(["packageValue"]),
    ],
  );
  const condition = await client.query<{ id: string }>(
    `INSERT INTO rule_conditions (
      business_rule_id, entity_type, effective_date, expiry_date
    ) VALUES ($1, 'PROCUREMENT_PACKAGE', '2026-01-01', '2026-12-31')
    RETURNING id`,
    [rule.rows[0].id],
  );
  const pack = await client.query<{ id: string }>(
    `INSERT INTO policy_packs (pack_name, regime_type, version)
     VALUES ($1, 'TEST', '1.0.0') RETURNING id`,
    [`Policy engine ${suffix}`],
  );
  const packRule = await client.query<{ id: string }>(
    `INSERT INTO policy_pack_rules (
      policy_pack_id, business_rule_id, rule_condition_id, is_mandatory
    ) VALUES ($1, $2, $3, true) RETURNING id`,
    [pack.rows[0].id, rule.rows[0].id, condition.rows[0].id],
  );

  const content: Omit<RuleSnapshot, "hash"> = {
    rule: {
      id: rule.rows[0].id,
      key: `minimum_value_${suffix}`,
      category: "COMPLIANCE",
      description: null,
      valueType: "BOOLEAN",
      defaultValue: null,
      formulaAst: formula as RuleSnapshot["rule"]["formulaAst"],
      allowedReferences: ["packageValue"],
      version: 1,
      mandatory: true,
    },
    condition: {
      entityType: "PROCUREMENT_PACKAGE",
      fundingSource: null,
      procurementMethod: null,
      packageValueMin: null,
      packageValueMax: null,
      scopeType: null,
      scopeId: null,
      effectiveDate: "2026-01-01",
      expiryDate: "2026-12-31",
    },
    source: {
      id: source.rows[0].id,
      regulationCode: `POLICY-ENGINE-${suffix}`,
      title: "Policy engine test",
      issuingAuthority: "Test Authority",
      authorityLevel: 99,
      isBinding: true,
      verificationStatus: "VERIFIED",
    },
    provision: {
      id: provision.rows[0].id,
      articleNumber: "1",
      provisionType: "COMPLIANCE",
      rawText: "Package value must meet threshold",
    },
  };
  const snapshot: RuleSnapshot = { ...content, hash: snapshotHash(content) };
  await client.query(
    "SELECT set_audit_context('test', 'SYSTEM', 'TEST', 'Publish test pack')",
  );
  await client.query(
    `UPDATE policy_pack_rules
     SET snapshot = $1::jsonb, snapshot_taken_at = now()
     WHERE id = $2`,
    [JSON.stringify(snapshot), packRule.rows[0].id],
  );
  await client.query(
    "UPDATE policy_packs SET status = 'REVIEWED' WHERE id = $1",
    [pack.rows[0].id],
  );
  await client.query(
    `UPDATE policy_packs
     SET status = 'PUBLISHED', published_at = now(), published_by = 'test'
     WHERE id = $1`,
    [pack.rows[0].id],
  );

  const stored = await client.query<{ snapshot: RuleSnapshot }>(
    "SELECT snapshot FROM policy_pack_rules WHERE id = $1",
    [packRule.rows[0].id],
  );
  const passing = evaluateRuleSnapshot(stored.rows[0].snapshot, {
    entityType: "PROCUREMENT_PACKAGE",
    context: { packageValue: 150, evaluationDate: "2026-09-20" },
  });
  assert.equal(passing.output.status, "PASS");

  const failing = evaluateRuleSnapshot(stored.rows[0].snapshot, {
    entityType: "PROCUREMENT_PACKAGE",
    context: { packageValue: 50, evaluationDate: "2026-09-20" },
  });
  assert.equal(failing.output.status, "FAIL");

  const expired = evaluateRuleSnapshot(stored.rows[0].snapshot, {
    entityType: "PROCUREMENT_PACKAGE",
    context: { packageValue: 150, evaluationDate: "2027-01-01" },
  });
  assert.equal(expired.output.status, "NOT_APPLICABLE");

  const numericContent: Omit<RuleSnapshot, "hash"> = {
    ...content,
    rule: { ...content.rule, formulaAst: null, defaultValue: 100 },
  };
  assert.throws(
    () =>
      evaluateRuleSnapshot(
        { ...numericContent, hash: snapshotHash(numericContent) },
        {
          entityType: "PROCUREMENT_PACKAGE",
          context: { evaluationDate: "2026-09-20" },
        },
      ),
    /must evaluate to boolean/,
  );

  const decision = await client.query<{ id: string }>(
    `INSERT INTO decision_references (
      entity_type, entity_id, policy_pack_id, policy_pack_version,
      evaluation_input, evaluation_result, snapshot, evaluator_version
    ) VALUES (
      'PROCUREMENT_PACKAGE', $1, $2, '1.0.0', $3::jsonb, $4::jsonb,
      $5::jsonb, $6
    ) RETURNING id`,
    [
      suffix,
      pack.rows[0].id,
      JSON.stringify({ packageValue: 150 }),
      JSON.stringify(passing.output),
      JSON.stringify({ ruleSnapshot: stored.rows[0].snapshot, passing }),
      EVALUATOR_VERSION,
    ],
  );
  const persisted = await client.query<{ evaluator_version: string }>(
    "SELECT evaluator_version FROM decision_references WHERE id = $1",
    [decision.rows[0].id],
  );
  assert.equal(persisted.rows[0].evaluator_version, EVALUATOR_VERSION);

  console.log("Policy engine integration tests passed");
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}