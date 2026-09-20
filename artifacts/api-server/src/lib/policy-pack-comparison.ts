export type ComparisonRule = {
  ruleKey: string;
  ruleVersion: number;
  isMandatory: boolean;
  rule: Record<string, unknown>;
  condition: Record<string, unknown> | null;
  source: Record<string, unknown>;
  provision: Record<string, unknown>;
};

export type ComparisonChange = {
  ruleKey: string;
  changeType: "ADDED" | "REMOVED" | "CHANGED";
  changedSections: Array<"RULE" | "CONDITION" | "SOURCE" | "PROVISION">;
  before: ComparisonRule | null;
  after: ComparisonRule | null;
};

export const comparisonJson = (value: unknown) =>
  JSON.stringify(value, (_key, nestedValue) =>
    nestedValue instanceof Date ? nestedValue.toISOString() : nestedValue,
  );

const contentFingerprint = (rule: ComparisonRule) =>
  comparisonJson({
    rule: rule.rule,
    condition: rule.condition,
    source: rule.source,
    provision: rule.provision,
  });

const changedSections = (
  before: ComparisonRule,
  after: ComparisonRule,
): ComparisonChange["changedSections"] =>
  [
    comparisonJson(before.rule) !== comparisonJson(after.rule) ? "RULE" : null,
    comparisonJson(before.condition) !== comparisonJson(after.condition)
      ? "CONDITION"
      : null,
    comparisonJson(before.source) !== comparisonJson(after.source)
      ? "SOURCE"
      : null,
    comparisonJson(before.provision) !== comparisonJson(after.provision)
      ? "PROVISION"
      : null,
  ].filter(
    (
      section,
    ): section is "RULE" | "CONDITION" | "SOURCE" | "PROVISION" =>
      section !== null,
  );

export function comparePolicyPackRules(
  baseRules: ComparisonRule[],
  targetRules: ComparisonRule[],
): ComparisonChange[] {
  const keys = [
    ...new Set([
      ...baseRules.map(({ ruleKey }) => ruleKey),
      ...targetRules.map(({ ruleKey }) => ruleKey),
    ]),
  ].sort();
  const changes: ComparisonChange[] = [];

  for (const ruleKey of keys) {
    const baseGroup = baseRules
      .filter((rule) => rule.ruleKey === ruleKey)
      .sort((a, b) => contentFingerprint(a).localeCompare(contentFingerprint(b)));
    const targetGroup = targetRules
      .filter((rule) => rule.ruleKey === ruleKey)
      .sort((a, b) => contentFingerprint(a).localeCompare(contentFingerprint(b)));

    const unmatchedBase = [...baseGroup];
    const unmatchedTarget: ComparisonRule[] = [];
    for (const target of targetGroup) {
      const exactIndex = unmatchedBase.findIndex(
        (base) => contentFingerprint(base) === contentFingerprint(target),
      );
      if (exactIndex >= 0) unmatchedBase.splice(exactIndex, 1);
      else unmatchedTarget.push(target);
    }

    while (unmatchedBase.length && unmatchedTarget.length) {
      const before = unmatchedBase.shift()!;
      const after = unmatchedTarget.shift()!;
      changes.push({
        ruleKey,
        changeType: "CHANGED",
        changedSections: changedSections(before, after),
        before,
        after,
      });
    }
    changes.push(
      ...unmatchedBase.map((before) => ({
        ruleKey,
        changeType: "REMOVED" as const,
        changedSections: ["RULE", "CONDITION"] as ComparisonChange["changedSections"],
        before,
        after: null,
      })),
      ...unmatchedTarget.map((after) => ({
        ruleKey,
        changeType: "ADDED" as const,
        changedSections: ["RULE", "CONDITION"] as ComparisonChange["changedSections"],
        before: null,
        after,
      })),
    );
  }

  return changes;
}