-- Keep the transition guard's SQLSTATE stable for integration tests and callers.
-- This function is also maintained in lib/db/sql/dre-guards.sql for fresh schemas.
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

    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         (OLD.status = 'DRAFT' AND NEW.status = 'REVIEWED')
         OR (OLD.status = 'REVIEWED' AND NEW.status = 'PUBLISHED')
         OR (OLD.status = 'PUBLISHED' AND NEW.status = 'RETIRED')
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2001',
        MESSAGE = format(
          'Invalid policy pack status transition from %s to %s',
          OLD.status, NEW.status
        );
    END IF;

    IF OLD.status = 'PUBLISHED' THEN
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