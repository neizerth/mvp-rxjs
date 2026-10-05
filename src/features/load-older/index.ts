import { Observable, Subject } from 'rxjs';
import { filter, exhaustMap } from 'rxjs/operators';
import { from, of } from 'rxjs';
import type { Deps } from '../deps';
import type { Action } from '../../model/types';

export function createLoadOlderFeature(deps: Deps, actions$: Subject<Action>): Observable<void> {
  return actions$.pipe(
    filter((a): a is { type: 'loadOlder/request' } => a.type === 'loadOlder/request'),
    exhaustMap(() => {
      const state = deps.store.getState();
      if (!state.hasOlder || state.loadingOlder) return of();

      state.setLoading(true);
      return from(deps.transport.loadHistory(state.oldestId)).pipe(
        exhaustMap(({ messages, hasMore }) => {
          state.prepend(messages, hasMore);
          return of();
        })
      );
    })
  );
}
