import {
  concatMap,
  filter,
  tap,
  startWith,
  withLatestFrom,
} from 'rxjs/operators';
import { Observable, Subject } from 'rxjs';
import type { Action } from '../../types';
import type { State } from '../../types';

export function createOutboxStream(
  connectionAction$: Observable<{
    type: 'connectionChanged';
    state: string;
  }>,
  state$: Observable<State>,
  sendAction$: Subject<{ clientId: string; text: string }>
): Observable<never> {
  return connectionAction$.pipe(
    filter((a) => a.state === 'connected'),
    withLatestFrom(state$),
    tap(([_, state]) => {
      state.pendingMessages.forEach((message, clientId) => {
        sendAction$.next({ clientId, text: message.text });
      });
    }),
    concatMap(() => new Observable<never>(() => {}))
  );
}
