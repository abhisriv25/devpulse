export interface RetrievalEvalCase {
  query: string;
  /** Document paths a human has judged relevant to this query — the
   * ground truth this case is scored against. */
  expectedPaths: string[];
}

export interface RetrievalEvalScore {
  precision: number;
  recall: number;
}

/**
 * Precision@K and recall@K for one query's results, given what was
 * actually retrieved (as document paths, already ranked/limited to K by
 * the caller) against a human-judged set of relevant paths.
 *
 * Pure function — no embedding calls, no database, so it's the same
 * "separate the pure logic from the I/O" pattern as the risk engine
 * (Slice 5) and the Markdown chunker (Slice 7). The actual "run real
 * queries against real retrieval and collect the retrieved paths" half of
 * an evaluation is I/O by nature and isn't something this function does —
 * this only scores results you already have.
 *
 * Doesn't chase academic precision: this is "evidence retrieval works,"
 * per the design doc, not a rigorous IR benchmark.
 */
export function scoreRetrieval(expectedPaths: string[], retrievedPaths: string[]): RetrievalEvalScore {
  const expectedSet = new Set(expectedPaths);
  const hits = retrievedPaths.filter((path) => expectedSet.has(path)).length;

  const precision = retrievedPaths.length === 0 ? 0 : hits / retrievedPaths.length;
  // A case with no expected documents at all is a vacuous "found everything
  // relevant" — recall 1, not a divide-by-zero. Real eval cases should
  // always specify at least one expected path; this just avoids NaN if one
  // doesn't.
  const recall = expectedPaths.length === 0 ? 1 : hits / expectedPaths.length;

  return { precision, recall };
}

/** Macro-averages precision/recall across every case — each query counts
 * equally regardless of how many documents its expected set has. */
export function scoreRetrievalSuite(
  results: { expectedPaths: string[]; retrievedPaths: string[] }[]
): RetrievalEvalScore {
  if (results.length === 0) return { precision: 0, recall: 0 };

  const scores = results.map((r) => scoreRetrieval(r.expectedPaths, r.retrievedPaths));
  return {
    precision: scores.reduce((sum, s) => sum + s.precision, 0) / scores.length,
    recall: scores.reduce((sum, s) => sum + s.recall, 0) / scores.length,
  };
}
