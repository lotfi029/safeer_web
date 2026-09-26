import type { FieldTree, TreeValidationResult, ValidationError } from '@angular/forms/signals';
import type { ApiProblem } from '../../core/api/problem';

/**
 * Maps an API problem's field errors (zod `issues[].path[0]`) onto a Signal Forms tree, for use as
 * the return value of a `submit()` action. Unknown paths are ignored here — show the problem's
 * general message (errors.codes.*) next to the submit button instead.
 */
export function problemToTreeErrors(
  form: FieldTree<Record<string, unknown>>,
  problem: ApiProblem,
): TreeValidationResult {
  const errors: ValidationError.WithFieldTree[] = [];
  const fields = form as unknown as Record<string, FieldTree<unknown> | undefined>;
  for (const [key, messages] of Object.entries(problem.fieldErrors)) {
    const fieldTree = fields[key];
    if (!fieldTree) {
      continue;
    }
    for (const message of messages) {
      errors.push({ kind: 'server', message, fieldTree });
    }
  }
  return errors.length ? errors : undefined;
}
