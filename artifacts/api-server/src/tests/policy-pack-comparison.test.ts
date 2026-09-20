import assert from "node:assert/strict";
import { comparePolicyPackRules, type ComparisonRule } from "../lib/policy-pack-comparison";

const entry = (
  conditionId: string,
  overrides: Partial<ComparisonRule> = {},
): ComparisonRule => ({
  ruleKey: "RULE-A",
  ruleVersion: 1,
  isMandatory: true,
  rule: { key: "RULE-A", version: 1, mandatory: true },
  condition: { scopeId: conditionId, entityType: "PACKAGE" },
  source: { regulationCode: "REG-1" },
  provision: { articleNumber: "1" },
  ...overrides,
});

{
  const changes = comparePolicyPackRules(
    [entry("scope-a"), entry("scope-b")],
    [entry("scope-a"), entry("scope-c")],
  );
  assert.equal(changes.length, 1);
  assert.equal(changes[0].changeType, "CHANGED");
  assert.deepEqual(changes[0].changedSections, ["CONDITION"]);
  assert.equal(changes[0].before?.condition?.scopeId, "scope-b");
  assert.equal(changes[0].after?.condition?.scopeId, "scope-c");
}

{
  const changes = comparePolicyPackRules(
    [entry("scope-a"), entry("scope-b")],
    [entry("scope-a")],
  );
  assert.equal(changes.length, 1);
  assert.equal(changes[0].changeType, "REMOVED");
  assert.equal(changes[0].before?.condition?.scopeId, "scope-b");
}

{
  const snapshot = entry("scope-a");
  const current = entry("scope-a", {
    ruleVersion: 2,
    rule: { key: "RULE-A", version: 2, mandatory: true },
  });
  const changes = comparePolicyPackRules([snapshot], [current]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].changeType, "CHANGED");
  assert.deepEqual(changes[0].changedSections, ["RULE"]);
}

console.log("policy-pack-comparison tests passed");