import type { Observable, OperatorFunction } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type { ActionMap, ActionType } from './deps';

/** Фильтр действий по типу и выделение payload. */
export function ofType<T extends ActionType>(
  type: T,
): OperatorFunction<{ type: ActionType; payload?: unknown }, ActionMap[T]> {
  return (source: Observable<{ type: ActionType; payload?: unknown }>) =>
    source.pipe(
      filter((action): action is { type: T; payload?: unknown } => action.type === type),
      map((action) => action.payload as ActionMap[T]),
    );
}
