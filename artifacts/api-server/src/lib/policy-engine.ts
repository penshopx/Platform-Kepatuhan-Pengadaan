import { createHash } from "node:crypto";
import {
  evaluateAst,
  type AstNode,
  type EvaluationContext,
  type Scalar,
} from "@workspace/db";

export const EVALUATOR_VERSION = "dre-ast-v1";

export type RuleSnapshot = {
  rule: {
    id: string;
    key: string;
    category: string;
    description: string | null;
    valueType: string;
    defaultValue: unknown;
    formulaAst: AstNode | null;
    allowedReferences: string[];
    version: number;
    mandatory: boolean;
  };
  condition: {
    entityType: string | null;
    fundingSource: string | null;
    procurementMethod: string | null;
    packageValueMin: number | null;
    packageValueMax: number | null;
    scopeType: string | null;
    scopeId: string | null;
    effectiveDate: string;
    expiryDate: string | null;
  } | null;
  source: {
    id: string;
    regulationCode: string;
    title: string;
    issuingAuthority: string;
    authorityLevel: number;
    isBinding: boolean;
    verificationStatus: string;
  };
  provision: {
    id: string;
    articleNumber: string;
    provisionType: string;
    rawText: string;
  };
  hash: string;
};

type EvaluationInput = {
  entityType: string;
  context: EvaluationContext;
};

export function snapshotHash(snapshot: Omit<RuleSnapshot, "hash">): string {
  return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}

export function evaluateRuleSnapshot(
  snapshot: RuleSnapshot,
  input: EvaluationInput,
) {
  const { hash, ...content } = snapshot;
  if (snapshotHash(content) !== hash) {
    throw new Error(`Rule snapshot integrity check failed: ${snapshot.rule.key}`);
  }
  if (!conditionMatches(snapshot.condition, input)) {
    return {
      rule: explainRule(snapshot),
      provision: snapshot.provision,
      source: snapshot.source,
      verificationStatus: snapshot.source.verificationStatus,
      input: conditionInput(snapshot.condition, input),
      output: {
        status: "NOT_APPLICABLE" as const,
        value: null,
        referencedPaths: [],
      },
    };
  }

  const evaluated = snapshot.rule.formulaAst
    ? evaluateAst(
        snapshot.rule.formulaAst,
        input.context,
        snapshot.rule.allowedReferences,
      )
    : { value: asScalar(snapshot.rule.defaultValue), referencedPaths: [] };
  if (typeof evaluated.value !== "boolean") {
    throw new Error(
      `Compliance rule must evaluate to boolean: ${snapshot.rule.key}`,
    );
  }
  const ruleInput = Object.fromEntries(
    evaluated.referencedPaths.map((path) => [path, input.context[path] ?? null]),
  );

  return {
    rule: explainRule(snapshot),
    provision: snapshot.provision,
    source: snapshot.source,
    verificationStatus: snapshot.source.verificationStatus,
    input: { ...conditionInput(snapshot.condition, input), ...ruleInput },
    output: {
      status: evaluated.value ? ("PASS" as const) : ("FAIL" as const),
      value: evaluated.value,
      referencedPaths: evaluated.referencedPaths,
    },
  };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function explainRule(snapshot: RuleSnapshot) {
  const { id, key, category, description, valueType, mandatory } = snapshot.rule;
  return { id, key, category, description, valueType, mandatory };
}

function conditionMatches(
  condition: RuleSnapshot["condition"],
  input: EvaluationInput,
): boolean {
  if (!condition) return true;
  const context = input.context;
  if (condition.entityType && condition.entityType !== input.entityType) return false;
  if (
    condition.fundingSource &&
    condition.fundingSource !== context.fundingSource
  ) return false;
  if (
    condition.procurementMethod &&
    condition.procurementMethod !== context.procurementMethod
  ) return false;
  if (condition.scopeType && condition.scopeType !== context.scopeType) return false;
  if (condition.scopeId && condition.scopeId !== context.scopeId) return false;

  const packageValue = context.packageValue;
  if (
    (condition.packageValueMin !== null ||
      condition.packageValueMax !== null) &&
    typeof packageValue !== "number"
  ) return false;
  if (
    typeof packageValue === "number" &&
    condition.packageValueMin !== null &&
    packageValue < condition.packageValueMin
  ) return false;
  if (
    typeof packageValue === "number" &&
    condition.packageValueMax !== null &&
    packageValue > condition.packageValueMax
  ) return false;

  const evaluationDate =
    typeof context.evaluationDate === "string"
      ? context.evaluationDate
      : new Date().toISOString().slice(0, 10);
  return (
    evaluationDate >= condition.effectiveDate &&
    (!condition.expiryDate || evaluationDate <= condition.expiryDate)
  );
}

function conditionInput(
  condition: RuleSnapshot["condition"],
  input: EvaluationInput,
) {
  if (!condition) return {};
  const paths = [
    "fundingSource",
    "procurementMethod",
    "packageValue",
    "scopeType",
    "scopeId",
    "evaluationDate",
  ];
  return {
    entityType: input.entityType,
    ...Object.fromEntries(
      paths
        .filter((path) => input.context[path] !== undefined)
        .map((path) => [path, input.context[path]]),
    ),
  };
}

function asScalar(value: unknown): Scalar {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) return value;
  throw new Error("Rule default value must be a scalar");
}