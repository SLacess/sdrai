import { EvalCaseSchema, type EvalCase } from './types';

/**
 * Parses a JSONL eval dataset, validating every line against EvalCaseSchema.
 * A malformed line fails loudly with its line number rather than being
 * silently dropped, so a corrupt dataset can't quietly shrink the suite.
 */
export function parseEvalDataset(jsonlText: string): EvalCase[] {
  const lines = jsonlText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  return lines.map((line, index) => {
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON on dataset line ${index + 1}: ${(error as Error).message}`);
    }
    const parsed = EvalCaseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Dataset line ${index + 1} failed schema validation: ${JSON.stringify(parsed.error.issues)}`);
    }
    return parsed.data;
  });
}
