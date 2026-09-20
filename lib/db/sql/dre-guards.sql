CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_audit_log_update ON audit_logs;
CREATE TRIGGER prevent_audit_log_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

DROP TRIGGER IF EXISTS prevent_audit_log_delete ON audit_logs;
CREATE TRIGGER prevent_audit_log_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

CREATE OR REPLACE FUNCTION set_audit_context(
  p_actor_id text,
  p_actor_type text,
  p_actor_role text,
  p_reason text
) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.actor_id', COALESCE(p_actor_id, ''), true);
  PERFORM set_config('app.actor_type', COALESCE(p_actor_type, 'SYSTEM'), true);
  PERFORM set_config('app.actor_role', COALESCE(p_actor_role, 'SYSTEM'), true);
  PERFORM set_config('app.action_reason', COALESCE(p_reason, ''), true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_dre_table_change()
RETURNS trigger AS $$
DECLARE
  v_actor_id text;
  v_actor_type text;
  v_actor_role text;
  v_reason text;
  v_entity_id text;
BEGIN
  v_actor_id := NULLIF(current_setting('app.actor_id', true), '');
  v_actor_type := COALESCE(NULLIF(current_setting('app.actor_type', true), ''), 'SYSTEM');
  v_actor_role := COALESCE(NULLIF(current_setting('app.actor_role', true), ''), 'SYSTEM');
  v_reason := NULLIF(current_setting('app.action_reason', true), '');

  IF TG_OP IN ('UPDATE', 'DELETE') AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Reason is required for % on %', TG_OP, TG_TABLE_NAME;
  END IF;

  v_entity_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.id::text
    ELSE NEW.id::text
  END;

  INSERT INTO audit_logs (
    actor_id, actor_type, actor_role, action_type, entity_type, entity_id,
    previous_state, new_state, reason
  ) VALUES (
    v_actor_id,
    v_actor_type,
    v_actor_role,
    CASE TG_OP WHEN 'INSERT' THEN 'CREATE' ELSE TG_OP END,
    TG_TABLE_NAME,
    v_entity_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    v_reason
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'legal_sources',
    'provisions',
    'business_rules',
    'rule_conditions',
    'rule_overrides',
    'policy_packs',
    'policy_pack_rules',
    'decision_references'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_dre_changes ON %I', table_name);
    EXECUTE format(
      'CREATE TRIGGER audit_dre_changes AFTER INSERT OR UPDATE OR DELETE ON %I
       FOR EACH ROW EXECUTE FUNCTION log_dre_table_change()',
      table_name
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION protect_policy_pack()
RETURNS trigger AS $$
DECLARE
  v_rule_count integer;
  v_missing_snapshot_count integer;
  v_unverified_binding_count integer;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'A policy pack must be created as DRAFT';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'RETIRED' THEN
      RAISE EXCEPTION 'A retired policy pack is immutable';
    END IF;

    IF OLD.status = 'PUBLISHED' THEN
      IF NEW.status <> 'RETIRED' THEN
        RAISE EXCEPTION 'A published policy pack can only transition to RETIRED';
      END IF;
      IF ROW(
        OLD.pack_name, OLD.regime_type, OLD.description, OLD.version,
        OLD.published_at, OLD.published_by, OLD.created_at
      ) IS DISTINCT FROM ROW(
        NEW.pack_name, NEW.regime_type, NEW.description, NEW.version,
        NEW.published_at, NEW.published_by, NEW.created_at
      ) THEN
        RAISE EXCEPTION 'Published policy pack content is immutable';
      END IF;
    END IF;

    IF NEW.status = 'PUBLISHED' AND OLD.status <> 'PUBLISHED' THEN
      IF OLD.status <> 'REVIEWED' THEN
        RAISE EXCEPTION 'Only a REVIEWED policy pack can be published';
      END IF;
      SELECT
        count(*),
        count(*) FILTER (
          WHERE snapshot IS NULL OR snapshot_taken_at IS NULL
        )
      INTO v_rule_count, v_missing_snapshot_count
      FROM policy_pack_rules
      WHERE policy_pack_id = NEW.id;

      IF v_rule_count = 0 THEN
        RAISE EXCEPTION 'A policy pack must contain at least one rule before publication';
      END IF;
      IF v_missing_snapshot_count > 0 THEN
        RAISE EXCEPTION 'Every rule requires a snapshot before publication';
      END IF;
      SELECT count(*)
      INTO v_unverified_binding_count
      FROM policy_pack_rules ppr
      JOIN business_rules br ON br.id = ppr.business_rule_id
      JOIN provisions p ON p.id = br.provision_id
      JOIN legal_sources ls ON ls.id = p.legal_source_id
      WHERE ppr.policy_pack_id = NEW.id
        AND ppr.is_mandatory
        AND ls.is_binding
        AND ls.verification_status <> 'VERIFIED';

      IF v_unverified_binding_count > 0 THEN
        RAISE EXCEPTION 'Binding rules must reference VERIFIED legal sources before publication';
      END IF;
      IF NEW.published_at IS NULL OR NEW.published_by IS NULL THEN
        RAISE EXCEPTION 'Publication timestamp and publisher are required';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_policy_pack_insert ON policy_packs;
CREATE TRIGGER protect_policy_pack_insert
BEFORE INSERT ON policy_packs
FOR EACH ROW EXECUTE FUNCTION protect_policy_pack();

DROP TRIGGER IF EXISTS protect_policy_pack_update ON policy_packs;
CREATE TRIGGER protect_policy_pack_update
BEFORE UPDATE ON policy_packs
FOR EACH ROW EXECUTE FUNCTION protect_policy_pack();

CREATE OR REPLACE FUNCTION protect_policy_pack_rule()
RETURNS trigger AS $$
DECLARE
  v_old_status text;
  v_new_status text;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT status INTO v_old_status
    FROM policy_packs
    WHERE id = OLD.policy_pack_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT status INTO v_new_status
    FROM policy_packs
    WHERE id = NEW.policy_pack_id;
  END IF;

  IF v_old_status IN ('PUBLISHED', 'RETIRED')
     OR v_new_status IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION 'Rules of published or retired policy packs are immutable';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_policy_pack_rule_change ON policy_pack_rules;
CREATE TRIGGER protect_policy_pack_rule_change
BEFORE INSERT OR UPDATE OR DELETE ON policy_pack_rules
FOR EACH ROW EXECUTE FUNCTION protect_policy_pack_rule();

CREATE OR REPLACE FUNCTION prevent_decision_reference_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Decision references are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_decision_reference_update ON decision_references;
CREATE TRIGGER prevent_decision_reference_update
BEFORE UPDATE ON decision_references
FOR EACH ROW EXECUTE FUNCTION prevent_decision_reference_modification();

DROP TRIGGER IF EXISTS prevent_decision_reference_delete ON decision_references;
CREATE TRIGGER prevent_decision_reference_delete
BEFORE DELETE ON decision_references
FOR EACH ROW EXECUTE FUNCTION prevent_decision_reference_modification();

