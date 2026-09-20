export class MissingReferenceError extends Error {
  constructor(public readonly path: string) {
    super(`Reference '${path}' not found in context`);
    this.name = "MissingReferenceError";
  }
}

export class InvalidFormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFormulaError";
  }
}

export class FormulaTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormulaTypeError";
  }
}
