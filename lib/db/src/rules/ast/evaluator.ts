import {
  FormulaTypeError,
  InvalidFormulaError,
  MissingReferenceError,
} from "./errors";
import { parseFormulaAst } from "./validator";
import type {
  AstNode,
  EvaluationContext,
  EvaluationResult,
  Scalar,
} from "./types";

export function evaluateAst(
  input: unknown,
  context: EvaluationContext,
  allowedReferences?: readonly string[],
): EvaluationResult {
  const ast = parseFormulaAst(input, allowedReferences);
  const referencedPaths = new Set<string>();

  const evaluate = (node: AstNode): Scalar => {
    if (node.type === "literal") return node.value;
    if (node.type === "reference") {
      referencedPaths.add(node.path);
      const value = context[node.path];
      if (value === undefined) throw new MissingReferenceError(node.path);
      return value;
    }
    if (node.type === "conditional") {
      const condition = evaluate(node.condition);
      if (typeof condition !== "boolean") {
        throw new FormulaTypeError("Conditional requires a boolean condition");
      }
      return condition ? evaluate(node.then) : evaluate(node.else);
    }
    return evaluateOperator(node.operator, node.operands, evaluate);
  };

  return {
    value: evaluate(ast),
    referencedPaths: [...referencedPaths],
  };
}

function evaluateOperator(
  operator: Extract<AstNode, { type: "operator" }>["operator"],
  operands: AstNode[],
  evaluate: (node: AstNode) => Scalar,
): Scalar {
  if (operator === "coalesce") {
    for (const operand of operands) {
      try {
        const value = evaluate(operand);
        if (value !== null) return value;
      } catch (error) {
        if (!(error instanceof MissingReferenceError)) throw error;
      }
    }
    return null;
  }
  if (operator === "and" || operator === "or") {
    for (const operand of operands) {
      const value = evaluate(operand);
      if (typeof value !== "boolean") {
        throw new FormulaTypeError(`${operator} requires boolean operands`);
      }
      if (operator === "and" && !value) return false;
      if (operator === "or" && value) return true;
    }
    return operator === "and";
  }

  const values = operands.map(evaluate);
  if (operator === "not") {
    requireArity(operator, values, 1);
    if (typeof values[0] !== "boolean") {
      throw new FormulaTypeError("not requires a boolean operand");
    }
    return !values[0];
  }
  if (operator === "eq" || operator === "neq") {
    requireArity(operator, values, 2);
    return operator === "eq" ? values[0] === values[1] : values[0] !== values[1];
  }

  const numeric = values.map((value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new FormulaTypeError(`${operator} requires finite numeric operands`);
    }
    return value;
  });

  if (["add", "subtract", "multiply", "divide"].includes(operator)) {
    requireArity(operator, numeric, 2);
    if (operator === "add") return numeric[0] + numeric[1];
    if (operator === "subtract") return numeric[0] - numeric[1];
    if (operator === "multiply") return numeric[0] * numeric[1];
    if (numeric[1] === 0) throw new InvalidFormulaError("Division by zero");
    return numeric[0] / numeric[1];
  }
  if (operator === "min" || operator === "max") {
    if (!numeric.length) {
      throw new InvalidFormulaError(`${operator} requires at least one operand`);
    }
    return operator === "min" ? Math.min(...numeric) : Math.max(...numeric);
  }
  if (["round", "floor", "ceil", "abs"].includes(operator)) {
    requireArity(operator, numeric, 1);
    if (operator === "round") return Math.round(numeric[0]);
    if (operator === "floor") return Math.floor(numeric[0]);
    if (operator === "ceil") return Math.ceil(numeric[0]);
    return Math.abs(numeric[0]);
  }
  if (operator === "clamp") {
    requireArity(operator, numeric, 3);
    if (numeric[1] > numeric[2]) {
      throw new InvalidFormulaError("clamp minimum cannot exceed maximum");
    }
    return Math.min(Math.max(numeric[0], numeric[1]), numeric[2]);
  }
  if (["gt", "gte", "lt", "lte"].includes(operator)) {
    requireArity(operator, numeric, 2);
    if (operator === "gt") return numeric[0] > numeric[1];
    if (operator === "gte") return numeric[0] >= numeric[1];
    if (operator === "lt") return numeric[0] < numeric[1];
    return numeric[0] <= numeric[1];
  }
  throw new InvalidFormulaError(`Unknown operator: ${operator}`);
}

function requireArity(
  operator: string,
  values: readonly unknown[],
  expected: number,
) {
  if (values.length !== expected) {
    throw new InvalidFormulaError(
      `${operator} requires exactly ${expected} operand(s)`,
    );
  }
}
