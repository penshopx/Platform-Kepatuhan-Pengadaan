BEGIN;

ALTER TABLE policy_packs
  DROP CONSTRAINT IF EXISTS policy_pack_version_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'policy_packs'::regclass
      AND conname = 'policy_pack_regime_version_unique'
  ) THEN
    ALTER TABLE policy_packs
      ADD CONSTRAINT policy_pack_regime_version_unique
      UNIQUE (pack_name, regime_type, version);
  END IF;
END
$$;

COMMIT;