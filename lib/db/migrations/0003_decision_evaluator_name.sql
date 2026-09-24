ALTER TABLE decision_references
  ADD COLUMN IF NOT EXISTS evaluator_name text;