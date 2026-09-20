import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../index";

const client = await pool.connect();

async function expectReject(sql: string, message: RegExp) {
  const savepoint = `sp_${randomUUID().replaceAll("-", "")}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await client.query(sql);
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    assert.match(error instanceof Error ? error.message : String(error), message);
    return;
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  assert.fail(`Expected query to be rejected: ${sql}`);
}

try {
  await client.query("BEGIN");
  const suffix = randomUUID().slice(0, 8);
  const source = await client.query<{ id: string }>(
    `INSERT INTO legal_sources (
      regulation_code, regulation_type, number, year, title,
      issuing_authority, authority_level, is_binding, status,
      verification_status
    ) VALUES ($1, 'TEST', '1', 2026, 'Test Source', 'Test Authority', 99,
      true, 'ACTIVE', 'VERIFIED') RETURNING id`,
    [`DRE-TEST-${suffix}`],
  );
  const sourceId = source.rows[0].id;

  const auditCount = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM audit_logs
     WHERE entity_type = 'legal_sources' AND entity_id = $1`,
    [sourceId],
  );
  assert.equal(auditCount.rows[0].count, "1");

  await client.query(
    "SELECT set_audit_context(NULL, 'SYSTEM', 'TEST', NULL)",
  );
  await expectReject(
    `UPDATE legal_sources SET title = 'No reason' WHERE id = '${sourceId}'`,
    /Reason is required/,
  );

  await client.query(
    "SELECT set_audit_context(NULL, 'SYSTEM', 'TEST', 'Test update')",
  );
  await client.query(
    "UPDATE legal_sources SET title = 'Updated test source' WHERE id = $1",
    [sourceId],
  );

  await expectReject(
    `INSERT INTO policy_packs (
      pack_name, regime_type, version, status
    ) VALUES ('Invalid ${suffix}', 'TEST', '1.0.0', 'PUBLISHED')`,
    /must be created as DRAFT/,
  );

  const provision = await client.query<{ id: string }>(
    `INSERT INTO provisions (
      legal_source_id, article_number, provision_type, raw_text
    ) VALUES ($1, '1', 'THRESHOLD', 'Test provision') RETURNING id`,
    [sourceId],
  );
  const rule = await client.query<{ id: string }>(
    `INSERT INTO business_rules (
      provision_id, rule_key, rule_category, default_value, value_type
    ) VALUES ($1, $2, 'THRESHOLD', '100'::jsonb, 'INTEGER') RETURNING id`,
    [provision.rows[0].id, `test_rule_${suffix}`],
  );
  const pack = await client.query<{ id: string }>(
    `INSERT INTO policy_packs (
      pack_name, regime_type, version
    ) VALUES ($1, 'TEST', '1.0.0') RETURNING id`,
    [`Test Pack ${suffix}`],
  );
  const packId = pack.rows[0].id;
  const packRule = await client.query<{ id: string }>(
    `INSERT INTO policy_pack_rules (
      policy_pack_id, business_rule_id, snapshot, snapshot_taken_at
    ) VALUES ($1, $2, '{"hash":"test"}'::jsonb, now()) RETURNING id`,
    [packId, rule.rows[0].id],
  );

  await client.query(
    "UPDATE policy_packs SET status = 'REVIEWED' WHERE id = $1",
    [packId],
  );
  await client.query(
    `UPDATE policy_packs
     SET status = 'PUBLISHED', published_at = now(), published_by = 'test'
     WHERE id = $1`,
    [packId],
  );

  await expectReject(
    `UPDATE policy_packs SET pack_name = 'Changed' WHERE id = '${packId}'`,
    /only transition to RETIRED|content is immutable/,
  );
  await expectReject(
    `UPDATE policy_pack_rules SET is_mandatory = false
     WHERE id = '${packRule.rows[0].id}'`,
    /Rules of published or retired policy packs are immutable/,
  );

  await client.query(
    "UPDATE policy_packs SET status = 'RETIRED' WHERE id = $1",
    [packId],
  );
  await expectReject(
    `UPDATE policy_packs SET status = 'DRAFT' WHERE id = '${packId}'`,
    /retired policy pack is immutable/,
  );

  const decision = await client.query<{ id: string }>(
    `INSERT INTO decision_references (
      entity_type, entity_id, policy_pack_id, policy_pack_version,
      evaluation_input, evaluation_result, snapshot, evaluator_version
    ) VALUES (
      'TEST', $1, $2, '1.0.0', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'test'
    ) RETURNING id`,
    [suffix, packId],
  );
  await expectReject(
    `UPDATE decision_references SET evaluator_version = 'changed'
     WHERE id = '${decision.rows[0].id}'`,
    /Decision references are immutable/,
  );

  const audit = await client.query<{ id: number }>(
    "SELECT id FROM audit_logs ORDER BY id DESC LIMIT 1",
  );
  await expectReject(
    `UPDATE audit_logs SET actor_role = 'changed' WHERE id = ${audit.rows[0].id}`,
    /Audit logs are immutable/,
  );

  const unverifiedSource = await client.query<{ id: string }>(
    `INSERT INTO legal_sources (
      regulation_code, regulation_type, number, year, title,
      issuing_authority, authority_level, is_binding, status,
      verification_status
    ) VALUES ($1, 'TEST', '2', 2026, 'Unverified Source', 'Test Authority',
      99, true, 'ACTIVE', 'UNVERIFIED') RETURNING id`,
    [`DRE-UNVERIFIED-${suffix}`],
  );
  const unverifiedProvision = await client.query<{ id: string }>(
    `INSERT INTO provisions (
      legal_source_id, article_number, provision_type, raw_text
    ) VALUES ($1, '2', 'THRESHOLD', 'Unverified provision') RETURNING id`,
    [unverifiedSource.rows[0].id],
  );
  const unverifiedRule = await client.query<{ id: string }>(
    `INSERT INTO business_rules (
      provision_id, rule_key, rule_category, default_value, value_type
    ) VALUES ($1, $2, 'THRESHOLD', '200'::jsonb, 'INTEGER') RETURNING id`,
    [unverifiedProvision.rows[0].id, `unverified_rule_${suffix}`],
  );
  const unverifiedPack = await client.query<{ id: string }>(
    `INSERT INTO policy_packs (
      pack_name, regime_type, version
    ) VALUES ($1, 'TEST', '1.0.0') RETURNING id`,
    [`Unverified Pack ${suffix}`],
  );
  await client.query(
    `INSERT INTO policy_pack_rules (
      policy_pack_id, business_rule_id, snapshot, snapshot_taken_at
    ) VALUES ($1, $2, '{"hash":"test"}'::jsonb, now())`,
    [unverifiedPack.rows[0].id, unverifiedRule.rows[0].id],
  );
  await client.query(
    "UPDATE policy_packs SET status = 'REVIEWED' WHERE id = $1",
    [unverifiedPack.rows[0].id],
  );
  await expectReject(
    `UPDATE policy_packs
     SET status = 'PUBLISHED', published_at = now(), published_by = 'test'
     WHERE id = '${unverifiedPack.rows[0].id}'`,
    /VERIFIED legal sources/,
  );

  console.log("DRE database trigger tests passed");
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}
