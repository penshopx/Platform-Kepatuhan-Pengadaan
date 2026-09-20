import assert from "node:assert/strict";
import {
  FormulaTypeError,
  InvalidFormulaError,
  evaluateAst,
} from "../rules/ast";

assert.equal(
  evaluateAst(
    {
      type: "operator",
      operator: "add",
      operands: [
        { type: "reference", path: "a" },
        {
          type: "operator",
          operator: "multiply",
          operands: [
            { type: "reference", path: "b" },
            { type: "reference", path: "c" },
          ],
        },
      ],
    },
    { a: 1, b: 2, c: 3 },
  ).value,
  7,
);

const coalesce = evaluateAst(
  {
    type: "operator",
    operator: "coalesce",
    operands: [
      { type: "reference", path: "missing" },
      { type: "literal", value: 42 },
    ],
  },
  {},
);
assert.equal(coalesce.value, 42);
assert.deepEqual(coalesce.referencedPaths, ["missing"]);

const shortCircuit = evaluateAst(
  {
    type: "operator",
    operator: "and",
    operands: [
      { type: "literal", value: false },
      { type: "reference", path: "must_not_be_read" },
    ],
  },
  {},
);
assert.equal(shortCircuit.value, false);
assert.deepEqual(shortCircuit.referencedPaths, []);

assert.throws(
  () =>
    evaluateAst(
      {
        type: "operator",
        operator: "divide",
        operands: [
          { type: "literal", value: 1 },
          { type: "literal", value: 0 },
        ],
      },
      {},
    ),
  InvalidFormulaError,
);

assert.throws(
  () =>
    evaluateAst(
      {
        type: "operator",
        operator: "add",
        operands: [
          { type: "literal", value: 1 },
          { type: "literal", value: "2" },
        ],
      },
      {},
    ),
  FormulaTypeError,
);

assert.throws(
  () =>
    evaluateAst(
      { type: "reference", path: "forbidden" },
      { forbidden: 1 },
      ["allowed"],
    ),
  /not allowed/,
);

console.log("AST evaluator tests passed");
