import { z } from "zod";
import type { AstNode } from "./types";

const operators = [
  "add",
  "subtract",
  "multiply",
  "divide",
  "min",
  "max",
  "round",
  "floor",
  "ceil",
  "abs",
  "clamp",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "and",
  "or",
  "not",
  "coalesce",
] as const;

export const formulaAstSchema: z.ZodType<AstNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("literal"),
      value: z.union([z.number().finite(), z.string(), z.boolean(), z.null()]),
    }),
    z.object({
      type: z.literal("reference"),
      path: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.]*$/),
    }),
    z.object({
      type: z.literal("operator"),
      operator: z.enum(operators),
      operands: z.array(formulaAstSchema).min(1),
    }),
    z.object({
      type: z.literal("conditional"),
      condition: formulaAstSchema,
      then: formulaAstSchema,
      else: formulaAstSchema,
    }),
  ]),
);

export function parseFormulaAst(
  input: unknown,
  allowedReferences?: readonly string[],
): AstNode {
  const ast = formulaAstSchema.parse(input);
  const stats = inspectAst(ast);
  if (stats.depth > 10) {
    throw new Error("Formula AST depth exceeds 10");
  }
  if (stats.nodes > 100) {
    throw new Error("Formula AST node count exceeds 100");
  }
  if (allowedReferences) {
    for (const reference of stats.references) {
      if (!allowedReferences.includes(reference)) {
        throw new Error(`Reference '${reference}' is not allowed`);
      }
    }
  }
  return ast;
}

function inspectAst(node: AstNode, depth = 1): {
  depth: number;
  nodes: number;
  references: Set<string>;
} {
  const result = {
    depth,
    nodes: 1,
    references: new Set<string>(),
  };
  if (node.type === "reference") {
    result.references.add(node.path);
    return result;
  }
  const children =
    node.type === "operator"
      ? node.operands
      : node.type === "conditional"
        ? [node.condition, node.then, node.else]
        : [];
  for (const child of children) {
    const inspected = inspectAst(child, depth + 1);
    result.depth = Math.max(result.depth, inspected.depth);
    result.nodes += inspected.nodes;
    inspected.references.forEach((value) => result.references.add(value));
  }
  return result;
}
