export function decisionEvaluatorLabel(decision: {
  evaluatorName: string | null;
  evaluatedBy: string | null;
}): string {
  return decision.evaluatorName?.trim()
    || (decision.evaluatedBy?.trim() ? `Pengguna ${decision.evaluatedBy.trim()}` : null)
    || "Evaluator tidak diketahui (data lama)";
}