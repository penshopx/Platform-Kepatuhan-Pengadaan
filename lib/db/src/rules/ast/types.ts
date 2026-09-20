export type Scalar = number | string | boolean | null;

export type AstNode =
  | { type: "literal"; value: Scalar }
  | { type: "reference"; path: string }
  | {
      type: "operator";
      operator:
        | "add"
        | "subtract"
        | "multiply"
        | "divide"
        | "min"
        | "max"
        | "round"
        | "floor"
        | "ceil"
        | "abs"
        | "clamp"
        | "eq"
        | "neq"
        | "gt"
        | "gte"
        | "lt"
        | "lte"
        | "and"
        | "or"
        | "not"
        | "coalesce";
      operands: AstNode[];
    }
  | {
      type: "conditional";
      condition: AstNode;
      then: AstNode;
      else: AstNode;
    };

export type EvaluationContext = Record<string, Scalar | undefined>;

export type EvaluationResult = {
  value: Scalar;
  referencedPaths: string[];
};
